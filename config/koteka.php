<?php

return [
    'trusted_proxies' => array_values(array_filter(array_map('trim', explode(',', (string) env('KOTEKA_TRUSTED_PROXIES', ''))))),
    'resend_api_key' => env('RESEND_API_KEY'),
    'from_email' => env('KOTEKA_FROM_EMAIL'),
    'notify_email' => env('KOTEKA_NOTIFY_EMAIL'),
    'meta_wa_token' => env('META_WA_TOKEN'),
    'meta_wa_phone_id' => env('META_WA_PHONE_NUMBER_ID'),
    'meta_wa_to' => env('META_WA_TO'),
    'meta_wa_template' => env('META_WA_TEMPLATE_NAME'),
    'meta_wa_language' => env('META_WA_TEMPLATE_LANGUAGE', 'id'),
];
