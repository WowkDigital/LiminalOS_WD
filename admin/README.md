# Liminal Admin Panel

To use the admin panel, you must run a PHP server.

## Quick Start (PHP Built-in Server)

If you have PHP installed, run this command in your terminal from the project root:

```bash
php -S localhost:8000 -t admin
```

Then open your browser to: [http://localhost:8000](http://localhost:8000)

## Features
- **Dashboard**: View all configured rooms.
- **Editor**: Create new rooms or edit existing ones.
- **Data**: All changes are saved directly to `world_data/rooms.json`.

## Requirements
- PHP 7.4 or higher
- Write permissions for `world_data/rooms.json`
