<?php

declare(strict_types=1);

use App\Http\AuthController;
use App\Http\HostsController;
use App\Model\Database;
use App\Model\HostRepo;
use App\Model\UserRepo;
use App\Security\Jwt;
use Dotenv\Dotenv;
use Psr\Http\Message\ResponseInterface as Response;
use Slim\Factory\AppFactory;
use Slim\Psr7\Response as SlimResponse;

require __DIR__ . '/../vendor/autoload.php';

$projectRoot = dirname(__DIR__);
$dotenv = Dotenv::createImmutable($projectRoot);
$dotenv->safeLoad();

$app = AppFactory::create();

$scriptName = $_SERVER['SCRIPT_NAME'] ?? '';
$basePath = rtrim(str_replace('\\', '/', dirname($scriptName)), '/');
if ($basePath !== '' && $basePath !== '/') {
    $app->setBasePath($basePath);
}

$app->addBodyParsingMiddleware();
$app->addRoutingMiddleware();

if (($app->getContainer() === null) && class_exists(\Slim\Middleware\ErrorMiddleware::class)) {
    $displayErrorDetails = filter_var($_ENV['APP_DEBUG'] ?? false, FILTER_VALIDATE_BOOLEAN);
    $app->addErrorMiddleware($displayErrorDetails, true, true);
}

$app->add(function ($request, $handler) {
    if ($request->getMethod() === 'OPTIONS') {
        $response = new SlimResponse(204);
    } else {
        $response = $handler->handle($request);
    }

    $origin = $_ENV['APP_ORIGIN'] ?? $request->getHeaderLine('Origin') ?: '*';

    return $response
        ->withHeader('Access-Control-Allow-Origin', $origin)
        ->withHeader('Access-Control-Allow-Credentials', 'true')
        ->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
        ->withHeader('Vary', 'Origin');
});

$app->get('/health', function ($request, Response $response) {
    $response->getBody()->write(json_encode(['status' => 'ok'], JSON_THROW_ON_ERROR));
    return $response->withHeader('Content-Type', 'application/json');
});

$pdo = Database::connection();
$userRepo = new UserRepo($pdo);
$hostRepo = new HostRepo($pdo);

$authController = new AuthController($userRepo);
$hostsController = new HostsController($hostRepo);
$authMiddleware = Jwt::middleware($userRepo);

$app->post('/auth/login', [$authController, 'login']);
$app->post('/auth/refresh', [$authController, 'refresh']);
$app->post('/auth/logout', [$authController, 'logout'])->add($authMiddleware);
$app->post('/auth/enable-2fa', [$authController, 'enableTwoFactor'])->add($authMiddleware);
$app->get('/hosts', [$hostsController, 'list'])->add($authMiddleware);
$app->get('/hosts/{id}/token', [$hostsController, 'issueBrokerToken'])->add($authMiddleware);

$app->run();
