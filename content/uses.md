+++
title = "Uses"
template = "uses.html"

[extra]
intro = "The kit behind the work. Reproducible where possible — the whole environment is declarative."

[[extra.categories]]
name = "Hardware"
[[extra.categories.items]]
name = "Linux workstation"
note = "Primary build box — lots of cores for Rust compiles."
[[extra.categories.items]]
name = "ThinkPad"
note = "Travel + couch driver, same config as everything else."

[[extra.categories]]
name = "OS & Environment"
[[extra.categories.items]]
name = "NixOS"
link = "https://github.com/dhilipsiva/NixOS"
note = "Declarative configs keep every machine identical. Reproducible by design."
[[extra.categories.items]]
name = "dotfiles"
note = "Versioned, portable, boring on purpose."

[[extra.categories]]
name = "Editor & Terminal"
[[extra.categories.items]]
name = "Neovim"
note = "Lives in the terminal; muscle memory I refuse to retrain."
[[extra.categories.items]]
name = "zsh + tmux"
note = "Panes, sessions, and a prompt that stays out of the way."

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
