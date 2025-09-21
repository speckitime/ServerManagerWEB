<?php

declare(strict_types=1);

namespace App\Model;

use PDO;
use PDOException;
use RuntimeException;

final class Database
{
    private static ?PDO $connection = null;

    public static function connection(): PDO
    {
        if (self::$connection instanceof PDO) {
            return self::$connection;
        }

        $dsn = $_ENV['DB_DSN'] ?? null;
        if (empty($dsn)) {
            throw new RuntimeException('Database DSN is not configured. Set DB_DSN in your environment.');
        }

        $username = $_ENV['DB_USER'] ?? '';
        $password = $_ENV['DB_PASS'] ?? '';

        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];

        try {
            self::$connection = new PDO($dsn, $username, $password, $options);
        } catch (PDOException $exception) {
            throw new RuntimeException('Unable to connect to the database: ' . $exception->getMessage(), (int) $exception->getCode(), $exception);
        }

        return self::$connection;
    }
}
