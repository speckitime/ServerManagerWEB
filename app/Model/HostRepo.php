<?php

declare(strict_types=1);

namespace App\Model;

use PDO;

final class HostRepo
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    public function listForUser(int $userId): array
    {
        $sql = <<<'SQL'
SELECT DISTINCT h.id, h.name, h.hostname, h.port, h.username
FROM hosts h
JOIN teams t ON t.id = h.team_id
LEFT JOIN team_members tm ON tm.team_id = h.team_id AND tm.user_id = :user_id
WHERE t.owner_id = :user_id OR tm.user_id IS NOT NULL
ORDER BY h.name ASC
SQL;

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute(['user_id' => $userId]);

        return $stmt->fetchAll() ?: [];
    }

    public function findAccessibleHost(int $hostId, int $userId): ?array
    {
        $sql = <<<'SQL'
SELECT h.*
FROM hosts h
JOIN teams t ON t.id = h.team_id
LEFT JOIN team_members tm ON tm.team_id = h.team_id AND tm.user_id = :user_id
WHERE h.id = :host_id AND (t.owner_id = :user_id OR tm.user_id IS NOT NULL)
LIMIT 1
SQL;

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            'host_id' => $hostId,
            'user_id' => $userId,
        ]);

        $host = $stmt->fetch();

        return $host !== false ? $host : null;
    }
}
