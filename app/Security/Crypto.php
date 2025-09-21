<?php

declare(strict_types=1);

namespace App\Security;

use RuntimeException;

final class Crypto
{
    public static function encrypt(string $plaintext, string $key): string
    {
        $binaryKey = self::normalizeKey($key);
        $nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        $ciphertext = sodium_crypto_secretbox($plaintext, $nonce, $binaryKey);

        return base64_encode($nonce . $ciphertext);
    }

    public static function decrypt(string $payload, string $key): string
    {
        $binaryKey = self::normalizeKey($key);
        $decoded = base64_decode($payload, true);
        if ($decoded === false || strlen($decoded) < SODIUM_CRYPTO_SECRETBOX_NONCEBYTES) {
            throw new RuntimeException('Invalid encrypted payload.');
        }

        $nonce = substr($decoded, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        $ciphertext = substr($decoded, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        $plaintext = sodium_crypto_secretbox_open($ciphertext, $nonce, $binaryKey);

        if ($plaintext === false) {
            throw new RuntimeException('Failed to decrypt payload.');
        }

        return $plaintext;
    }

    private static function normalizeKey(string $key): string
    {
        if (str_starts_with($key, 'base64:')) {
            $key = substr($key, 7);
            $decoded = base64_decode($key, true);
            if ($decoded === false) {
                throw new RuntimeException('Invalid base64 key provided.');
            }

            return $decoded;
        }

        if (strlen($key) < SODIUM_CRYPTO_SECRETBOX_KEYBYTES) {
            return hash('sha256', $key, true);
        }

        return $key;
    }
}
