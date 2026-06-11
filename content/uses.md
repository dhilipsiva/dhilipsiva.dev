+++
title = "Uses"
template = "uses.html"

[extra]
intro = "The kit behind the work. Reproducible where possible — the whole environment is declarative."

[[extra.categories]]
name = "Hardware"
[[extra.categories.items]]
name = "Ryzen 9 9950X3D · RTX 5090 · 96GB"
note = "Primary build box — work by day, games by night. The twins on this site were trained here."
[[extra.categories.items]]
name = "MacBook M4 Pro"
note = "Local LLM inference with mlx_lm."
[[extra.categories.items]]
name = "ThinkPad"
note = "Travel + couch driver, same config as everything else."

[[extra.categories]]
name = "OS & Environment"
[[extra.categories.items]]
name = "NixOS unstable"
link = "https://github.com/dhilipsiva/NixOS"
note = "One flake-based config shared across machines; secrets via sops-nix. Reproducible by design."
[[extra.categories.items]]
name = "Hyprland"
note = "Launched from a TTY — no display manager, no ceremony."
[[extra.categories.items]]
name = "dotfiles (~/.files)"
note = "Versioned, portable, boring on purpose."

[[extra.categories]]
name = "Editor & Terminal"
[[extra.categories.items]]
name = "helix"
note = "Modal like vim, batteries included, written in Rust."
[[extra.categories.items]]
name = "fish + zellij"
note = "Panes, sessions, and a prompt that stays out of the way — with atuin and starship."
[[extra.categories.items]]
name = "alacritty"
note = "The terminal itself — GPU-fast, config in a file."

[[extra.categories]]
name = "Languages & Tools"
[[extra.categories.items]]
name = "Rust"
note = "Default for anything that has to be correct and fast."
[[extra.categories.items]]
name = "Python"
note = "Glue, services, and quick reasoning experiments."
[[extra.categories.items]]
name = "Wasmtime"
note = "Running Wasm components outside the browser."

[[extra.categories]]
name = "Services"
[[extra.categories.items]]
name = "GitHub"
link = "https://github.com/dhilipsiva"
note = "Where the source lives."
[[extra.categories.items]]
name = "Zola"
link = "https://www.getzola.org/"
note = "Builds this site — fast, single binary, no Node."
+++
