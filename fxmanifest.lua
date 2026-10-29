name 'ai-death'
author 'ai-core'
version '0.1.0'
license 'GPL-3.0-only'
description 'Death, respawn at hospitals, EMS revive and treatment'
fx_version 'cerulean'
game 'gta5'
node_version '22'

client_script 'dist/client.js'
server_script 'dist/server.js'
ui_page 'dist/web/index.html'

dependencies {
	'/onesync',
	'ai-core',
}

files {
	'locales/*.json',
	'dist/web/*.html',
	'dist/web/assets/*.js',
	'dist/web/assets/*.css',
	'dist/web/assets/*.woff',
	'dist/web/assets/*.woff2',
	'data/settings.json',
	'data/hospitals.json',
}
