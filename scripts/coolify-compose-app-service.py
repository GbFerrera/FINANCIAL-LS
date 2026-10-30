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


def write_compose_override(src: str, dst: str, image: str) -> str:
    """Gera override mínimo (merge) para não perder env/env_file do compose Coolify."""
    import yaml

    with open(src, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    services = data.get("services") or {}
    key = app_service_name(services)
    override = {
        "services": {
            key: {
                "image": image,
                "pull_policy": "always",
            }
        }
    }
    with open(dst, "w", encoding="utf-8") as f:
        yaml.dump(override, f, default_flow_style=False, sort_keys=False)
    return key


if __name__ == "__main__":
    import yaml

    if len(sys.argv) != 4:
        print(
            "usage: coolify-compose-app-service.py <src-compose> <dst-compose|override> <image>",
            file=sys.stderr,
        )
        sys.exit(2)
    src, dst, image = sys.argv[1:4]
    if dst.endswith("-override.yaml") or dst.endswith(".override.yaml"):
        service = write_compose_override(src, dst, image)
        print(service)
        sys.exit(0)

    with open(src, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    data, service = patch_compose_for_ghcr_image(data, image)
    with open(dst, "w", encoding="utf-8") as f:
        yaml.dump(data, f, default_flow_style=False, sort_keys=False)
    print(service)
