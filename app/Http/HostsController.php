<?php

declare(strict_types=1);

namespace App\Http;

use App\Model\HostRepo;
use App\Security\Jwt;
use Slim\Psr7\Response;

final class HostsController
{
    public function __construct(private readonly HostRepo $hosts)
    {
    }

    public function list($request, Response $response): Response
    {
        $userId = (int) $request->getAttribute('user_id');
        $hosts = array_map(static function (array $host): array {
            return [
                'id' => (int) $host['id'],
                'name' => $host['name'],
                'hostname' => $host['hostname'],
                'port' => (int) $host['port'],
                'username' => $host['username'],
            ];
        }, $this->hosts->listForUser($userId));

        return $this->json($response, ['hosts' => $hosts]);
    }

    public function issueBrokerToken($request, Response $response, array $args): Response
    {
        $hostId = (int) ($args['id'] ?? 0);
        $userId = (int) $request->getAttribute('user_id');

        if ($hostId <= 0) {
            return $this->json($response->withStatus(404), ['error' => 'host_not_found']);
        }

        $host = $this->hosts->findAccessibleHost($hostId, $userId);
        if ($host === null) {
            return $this->json($response->withStatus(403), ['error' => 'access_denied']);
        }

        $token = Jwt::issue([
            'sub' => $userId,
            'host_id' => $hostId,
            'scope' => 'host.connect',
        ], 60);

        $payload = [
            'token' => $token,
            'wsUrl' => $_ENV['BROKER_WS_URL'] ?? '/ws',
        ];

        return $this->json($response, $payload);
    }

    private function json(Response $response, array $payload): Response
    {
        $response->getBody()->write(json_encode($payload, JSON_THROW_ON_ERROR));
        return $response->withHeader('Content-Type', 'application/json');
    }
}
