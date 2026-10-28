<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Koteka Digital - Laravel 13 routes
require __DIR__.'/koteka.php';
