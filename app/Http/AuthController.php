<?php

declare(strict_types=1);

namespace App\Http;

use App\Model\UserRepo;
use App\Security\Jwt;
use DateInterval;
use DateTimeImmutable;
use JsonException;
use RobThree\Auth\TwoFactorAuth;
use RuntimeException;
use RobThree\Auth\TwoFactorAuthException;
use Slim\Psr7\Response;

final class AuthController
{
    public function __construct(private readonly UserRepo $users)
    {
    }

    public function login($request, Response $response): Response
    {
        $payload = (array) $request->getParsedBody();
        $email = filter_var($payload['email'] ?? '', FILTER_VALIDATE_EMAIL);
        $password = (string) ($payload['password'] ?? '');

        if ($email === false || $password === '') {
            return $this->json($response->withStatus(422), [
                'error' => 'invalid_credentials',
                'message' => 'Email and password are required.',
            ]);
        }

        $user = $this->users->findByEmail($email);
        if ($user === null || !$this->users->verifyPassword($user, $password)) {
            usleep(random_int(10_000, 80_000));
            return $this->json($response->withStatus(401), [
                'error' => 'invalid_credentials',
                'message' => 'The provided credentials are incorrect.',
            ]);
        }

        if (!empty($user['totp_secret'])) {
            $totpCode = $payload['totp'] ?? null;
            if (!$this->verifyTotp($user['totp_secret'], $totpCode)) {
                return $this->json($response->withStatus(401), [
                    'error' => 'totp_required',
                    'message' => 'Two-factor authentication required.',
                ]);
            }
        }

        $accessToken = Jwt::issue(['sub' => (int) $user['id']]);
        $refreshToken = bin2hex(random_bytes(32));
        $refreshTtl = new DateInterval('PT' . (int) ($_ENV['REFRESH_TOKEN_TTL'] ?? 604800) . 'S');
        $userAgent = $request->getHeaderLine('User-Agent') ?: null;
        $ip = $request->getServerParams()['REMOTE_ADDR'] ?? null;

        $this->users->createSession((int) $user['id'], $refreshToken, $userAgent, $ip, $refreshTtl);

        $cookieParams = [
            'expires' => (new DateTimeImmutable('now'))->add($refreshTtl)->getTimestamp(),
            'path' => '/',
            'domain' => $this->cookieDomain(),
            'secure' => true,
            'httponly' => true,
            'samesite' => 'Strict',
        ];
        $response = $this->setCookie($response, 'refresh_token', $refreshToken, $cookieParams);
        $response = $this->setCookie($response, 'access_token', $accessToken, [
            'expires' => time() + (int) ($_ENV['ACCESS_TOKEN_TTL'] ?? 900),
            'path' => '/',
            'domain' => $this->cookieDomain(),
            'secure' => true,
            'httponly' => true,
            'samesite' => 'Strict',
        ]);

        return $this->json($response, [
            'access_token' => $accessToken,
            'token_type' => 'Bearer',
            'expires_in' => (int) ($_ENV['ACCESS_TOKEN_TTL'] ?? 900),
        ]);
    }

    public function refresh($request, Response $response): Response
    {
        $refreshToken = $request->getCookieParams()['refresh_token'] ?? ($request->getParsedBody()['refresh_token'] ?? null);
        if ($refreshToken === null) {
            return $this->json($response->withStatus(401), [
                'error' => 'missing_refresh_token',
            ]);
        }

        $session = $this->users->findSessionByToken($refreshToken);
        if ($session === null || new DateTimeImmutable($session['expires_at']) <= new DateTimeImmutable('now')) {
            return $this->json($response->withStatus(401), ['error' => 'invalid_refresh_token']);
        }

        $user = $this->users->findById((int) $session['user_id']);
        if ($user === null) {
            return $this->json($response->withStatus(401), ['error' => 'user_not_found']);
        }

        $newRefreshToken = bin2hex(random_bytes(32));
        $refreshTtl = new DateInterval('PT' . (int) ($_ENV['REFRESH_TOKEN_TTL'] ?? 604800) . 'S');
        try {
            $this->users->rotateSession((int) $user['id'], $refreshToken, $newRefreshToken, $refreshTtl);
        } catch (RuntimeException) {
            return $this->json($response->withStatus(401), ['error' => 'invalid_refresh_token']);
        }

        $accessToken = Jwt::issue(['sub' => (int) $user['id']]);

        $response = $this->setCookie($response, 'refresh_token', $newRefreshToken, [
            'expires' => (new DateTimeImmutable('now'))->add($refreshTtl)->getTimestamp(),
            'path' => '/',
            'domain' => $this->cookieDomain(),
            'secure' => true,
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
        $response = $this->setCookie($response, 'access_token', $accessToken, [
            'expires' => time() + (int) ($_ENV['ACCESS_TOKEN_TTL'] ?? 900),
            'path' => '/',
            'domain' => $this->cookieDomain(),
            'secure' => true,
            'httponly' => true,
            'samesite' => 'Strict',
        ]);

        return $this->json($response, [
            'access_token' => $accessToken,
            'token_type' => 'Bearer',
            'expires_in' => (int) ($_ENV['ACCESS_TOKEN_TTL'] ?? 900),
        ]);
    }

    public function logout($request, Response $response): Response
    {
        $refreshToken = $request->getCookieParams()['refresh_token'] ?? ($request->getParsedBody()['refresh_token'] ?? null);
        if ($refreshToken !== null) {
            $this->users->revokeSession($refreshToken);
        }

        $response = $this->expireCookie($response, 'refresh_token');
        $response = $this->expireCookie($response, 'access_token');

        return $this->json($response, ['success' => true]);
    }

    public function enableTwoFactor($request, Response $response): Response
    {
        $userId = (int) $request->getAttribute('user_id');
        $payload = (array) $request->getParsedBody();

        $enable = filter_var($payload['enable'] ?? null, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        if ($enable === null) {
            return $this->json($response->withStatus(422), [
                'error' => 'invalid_payload',
                'message' => 'Set "enable" to true or false.',
            ]);
        }

        $tfa = new TwoFactorAuth('ServerManager');

        if ($enable === true) {
            $secret = $tfa->createSecret(160);
            $recoveryCodes = array_map(fn () => bin2hex(random_bytes(5)), range(1, 8));
            try {
                $this->users->updateTotpSecret($userId, $secret, $recoveryCodes);
            } catch (JsonException) {
                return $this->json($response->withStatus(500), ['error' => 'totp_setup_failed']);
            }

            return $this->json($response, [
                'secret' => $secret,
                'qr_code' => $tfa->getQRCodeImageAsDataUri('ServerManager', $secret),
                'recovery_codes' => $recoveryCodes,
            ]);
        }

        try {
            $this->users->updateTotpSecret($userId, null, null);
        } catch (JsonException) {
            return $this->json($response->withStatus(500), ['error' => 'totp_disable_failed']);
        }

        return $this->json($response, ['disabled' => true]);
    }

    private function verifyTotp(string $secret, ?string $code): bool
    {
        if ($code === null) {
            return false;
        }

        try {
            $tfa = new TwoFactorAuth('ServerManager');
            return $tfa->verifyCode(rtrim($secret, "\0"), $code, 2);
        } catch (TwoFactorAuthException) {
            return false;
        }
    }

    private function json(Response $response, array $payload): Response
    {
        $response->getBody()->write(json_encode($payload, JSON_THROW_ON_ERROR));
        return $response->withHeader('Content-Type', 'application/json');
    }

    private function setCookie(Response $response, string $name, string $value, array $options): Response
    {
        $cookie = sprintf('%s=%s', rawurlencode($name), rawurlencode($value));

        if (isset($options['expires'])) {
            $cookie .= '; Expires=' . gmdate('D, d M Y H:i:s \G\M\T', (int) $options['expires']);
        }
        if (!empty($options['path'])) {
            $cookie .= '; Path=' . $options['path'];
        }
        if (!empty($options['domain'])) {
            $cookie .= '; Domain=' . $options['domain'];
        }
        if (!empty($options['secure'])) {
            $cookie .= '; Secure';
        }
        if (!empty($options['httponly'])) {
            $cookie .= '; HttpOnly';
        }
        if (!empty($options['samesite'])) {
            $cookie .= '; SameSite=' . $options['samesite'];
        }

        return $response->withAddedHeader('Set-Cookie', $cookie);
    }

    private function expireCookie(Response $response, string $name): Response
    {
        return $this->setCookie($response, $name, 'deleted', [
            'expires' => time() - 3600,
            'path' => '/',
            'domain' => $this->cookieDomain(),
            'secure' => true,
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
    }

    private function cookieDomain(): ?string
    {
        $origin = $_ENV['APP_ORIGIN'] ?? null;
        if ($origin === null) {
            return null;
        }

        $host = parse_url($origin, PHP_URL_HOST);

        return $host !== false ? $host : null;
    }
}
