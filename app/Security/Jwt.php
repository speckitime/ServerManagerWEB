<?php

declare(strict_types=1);

namespace App\Security;

use App\Model\UserRepo;
use Firebase\JWT\JWT as FirebaseJwt;
use Firebase\JWT\Key;
use Psr\Http\Message\ResponseInterface as ResponseInterface;
use Psr\Http\Message\ServerRequestInterface as ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Slim\Psr7\Response;
use UnexpectedValueException;

final class Jwt
{
    private const DEFAULT_ALGO = 'HS256';

    public static function issue(array $claims, ?int $ttlSeconds = null): string
    {
        $ttlSeconds ??= (int) ($_ENV['ACCESS_TOKEN_TTL'] ?? 900);
        $now = time();
        $payload = $claims;
        $payload['iat'] = $payload['iat'] ?? $now;
        $payload['exp'] = $payload['exp'] ?? $now + $ttlSeconds;

        return FirebaseJwt::encode($payload, self::secret(), self::DEFAULT_ALGO);
    }

    public static function verify(string $token): array
    {
        return (array) FirebaseJwt::decode($token, new Key(self::secret(), self::DEFAULT_ALGO));
    }

    public static function middleware(UserRepo $users): MiddlewareInterface
    {
        return new class($users) implements MiddlewareInterface {
            public function __construct(private readonly UserRepo $users)
            {
            }

            public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
            {
                $token = self::extractToken($request);
                if ($token === null) {
                    return $this->unauthorized('missing_token');
                }

                try {
                    $payload = Jwt::verify($token);
                } catch (UnexpectedValueException $exception) {
                    return $this->unauthorized('invalid_token');
                }

                $userId = (int) ($payload['sub'] ?? 0);
                if ($userId <= 0 || $this->users->findById($userId) === null) {
                    return $this->unauthorized('unknown_user');
                }

                $request = $request
                    ->withAttribute('token_payload', $payload)
                    ->withAttribute('user_id', $userId);

                return $handler->handle($request);
            }

            private function unauthorized(string $reason): ResponseInterface
            {
                $response = new Response(401);
                $response->getBody()->write(json_encode([
                    'error' => 'unauthorized',
                    'reason' => $reason,
                ], JSON_THROW_ON_ERROR));

                return $response->withHeader('Content-Type', 'application/json');
            }

            private function extractToken(ServerRequestInterface $request): ?string
            {
                $header = $request->getHeaderLine('Authorization');
                if (str_starts_with($header, 'Bearer ')) {
                    return trim(substr($header, 7));
                }

                $cookieParams = $request->getCookieParams();
                return $cookieParams['access_token'] ?? null;
            }
        };
    }

    private static function secret(): string
    {
        $secret = $_ENV['JWT_SECRET'] ?? '';
        if (str_starts_with($secret, 'base64:')) {
            $secret = substr($secret, 7);
        } elseif ($secret === '' && isset($_ENV['JWT_SECRET_B64'])) {
            $secret = $_ENV['JWT_SECRET_B64'];
        }

        $decoded = base64_decode($secret, true);
        if ($decoded !== false && $decoded !== '') {
            return $decoded;
        }

        if ($secret === '') {
            throw new UnexpectedValueException('JWT secret is not configured.');
        }

        return $secret;
    }
}
