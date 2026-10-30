"""Resolve o nome do serviço da aplicação no docker-compose gerado pelo Coolify."""
from __future__ import annotations

import sys


def app_service_name(services: dict) -> str:
    if not services:
        raise KeyError("compose sem services")
    if "app" in services:
        return "app"
    skip_tokens = ("db", "postgres", "redis", "mysql", "mariadb", "mongo")
    for name in services:
        low = name.lower()
        if any(tok in low for tok in skip_tokens):
            continue
        return name
    return next(iter(services))


def patch_compose_for_ghcr_image(data: dict, image: str) -> tuple[dict, str]:
    services = data.get("services") or {}
    key = app_service_name(services)
    app = services[key]
    app.pop("build", None)
    app["image"] = image
    app["pull_policy"] = "always"
    return data, key


def _load_dotenv(path: str) -> dict[str, str]:
    out: dict[str, str] = {}
    with open(path, encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("export "):
                line = line[7:].strip()
            key, sep, val = line.partition("=")
            if not sep:
                continue
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            out[key] = val
    return out


def _coolify_env_files(app_dir: str) -> list[str]:
    import os

    names: list[str] = []
    for name in (".env", ".env.production", ".env.local"):
        if os.path.isfile(os.path.join(app_dir, name)):
            names.append(name)
    return names


def write_compose_override(src: str, dst: str, image: str, app_dir: str | None = None) -> str:
    """Gera override mínimo (merge) para não perder env/env_file do compose Coolify."""
    import os

    import yaml

    with open(src, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    services = data.get("services") or {}
    key = app_service_name(services)
    svc_override: dict = {
        "image": image,
        "pull_policy": "always",
    }
    if app_dir:
        env_files = _coolify_env_files(app_dir)
        if env_files:
            svc_override["env_file"] = env_files
            merged: dict[str, str] = {}
            for rel in env_files:
                merged.update(_load_dotenv(os.path.join(app_dir, rel)))
            if merged:
                svc_override["environment"] = merged
    override = {"services": {key: svc_override}}
    with open(dst, "w", encoding="utf-8") as f:
        yaml.dump(override, f, default_flow_style=False, sort_keys=False)
    return key


if __name__ == "__main__":
    import yaml

    if len(sys.argv) not in (4, 5):
        print(
            "usage: coolify-compose-app-service.py <src-compose> <dst-compose|override> <image> [app_dir]",
            file=sys.stderr,
        )
        sys.exit(2)
    src, dst, image = sys.argv[1:4]
    app_dir = sys.argv[4] if len(sys.argv) == 5 else None
    if dst.endswith("-override.yaml") or dst.endswith(".override.yaml"):
        service = write_compose_override(src, dst, image, app_dir)
        print(service)
        sys.exit(0)

    with open(src, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    data, service = patch_compose_for_ghcr_image(data, image)
    with open(dst, "w", encoding="utf-8") as f:
        yaml.dump(data, f, default_flow_style=False, sort_keys=False)
    print(service)
