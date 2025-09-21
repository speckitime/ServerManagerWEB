<?php

declare(strict_types=1);

namespace App\Model;

use DateInterval;
use DateTimeImmutable;
use PDO;
use RuntimeException;

final class UserRepo
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    public function findByEmail(string $email): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM users WHERE email = :email LIMIT 1');
        $stmt->execute(['email' => $email]);
        $user = $stmt->fetch();

        return $user !== false ? $user : null;
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM users WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $user = $stmt->fetch();

        return $user !== false ? $user : null;
    }

    public function verifyPassword(array $user, string $password): bool
    {
        $hash = $user['password_hash'] ?? '';
        if ($hash === '') {
            return false;
        }

        return password_verify($password, $hash);
    }

    public function createSession(int $userId, string $refreshToken, ?string $userAgent, ?string $ip, DateInterval $ttl): array
    {
        $expiresAt = (new DateTimeImmutable('now'))->add($ttl);

        $stmt = $this->pdo->prepare('INSERT INTO sessions (user_id, refresh_token_hash, user_agent, ip, created_at, expires_at) VALUES (:user_id, :refresh_token_hash, :user_agent, :ip, :created_at, :expires_at)');
        $stmt->execute([
            'user_id' => $userId,
            'refresh_token_hash' => $this->hashToken($refreshToken),
            'user_agent' => $userAgent,
            'ip' => $ip !== null ? inet_pton($ip) : null,
            'created_at' => (new DateTimeImmutable('now'))->format('Y-m-d H:i:s'),
            'expires_at' => $expiresAt->format('Y-m-d H:i:s'),
        ]);

        return ['expires_at' => $expiresAt];
    }

    public function revokeSession(string $refreshToken): void
    {
        $stmt = $this->pdo->prepare('DELETE FROM sessions WHERE refresh_token_hash = :hash');
        $stmt->execute(['hash' => $this->hashToken($refreshToken)]);
    }

    public function rotateSession(int $userId, string $oldToken, string $newToken, DateInterval $ttl): array
    {
        $expiresAt = (new DateTimeImmutable('now'))->add($ttl);

        $stmt = $this->pdo->prepare('UPDATE sessions SET refresh_token_hash = :new_hash, expires_at = :expires_at WHERE user_id = :user_id AND refresh_token_hash = :old_hash');
        $stmt->execute([
            'user_id' => $userId,
            'new_hash' => $this->hashToken($newToken),
            'expires_at' => $expiresAt->format('Y-m-d H:i:s'),
            'old_hash' => $this->hashToken($oldToken),
        ]);

        if ($stmt->rowCount() === 0) {
            throw new RuntimeException('Refresh token could not be rotated.');
        }

        return ['expires_at' => $expiresAt];
    }

    public function findSessionByToken(string $refreshToken): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM sessions WHERE refresh_token_hash = :hash LIMIT 1');
        $stmt->execute(['hash' => $this->hashToken($refreshToken)]);
        $session = $stmt->fetch();

        return $session !== false ? $session : null;
    }

    public function updateTotpSecret(int $userId, ?string $secret, ?array $recoveryCodes): void
    {
        $stmt = $this->pdo->prepare('UPDATE users SET totp_secret = :secret, recovery_codes = :recovery WHERE id = :id');
        $stmt->execute([
            'secret' => $secret,
            'recovery' => $recoveryCodes !== null ? json_encode($recoveryCodes, JSON_THROW_ON_ERROR) : null,
            'id' => $userId,
        ]);
    }

    private function hashToken(string $token): string
    {
        return hash('sha256', $token, binary: true);
    }
}
