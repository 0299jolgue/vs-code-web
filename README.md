# VS Code Web for Shard Cloud

This repository now runs a real **VS Code-compatible browser IDE** using [code-server](https://github.com/coder/code-server), instead of a custom Monaco clone.

That means the browser gets the normal VS Code workbench: Explorer, editor tabs, Command Palette, integrated terminal, source control UI, settings, debugger UI, extensions, IntelliSense/language services and the standard Welcome/Getting Started experience.

## Shard Cloud / port 80

The app listens on:

- `0.0.0.0:80`
- never 8080 for the public service.

Development servers such as Live Server may listen on an internal port. code-server exposes those through its built-in **`/proxy/<port>/`** route, so the public service still uses only port 80.

The container sets:

`VSCODE_PROXY_URI=./proxy/{{port}}/`

so forwarded ports are generated relative to the Shard Cloud URL.

## First launch

The IDE opens an empty workspace at `/home/coder/workspace`. There is deliberately **no starter HTML/Python code**. On first launch the editor can show the normal VS Code-style Getting Started/Welcome experience.

## Extensions installed in the image

- `ritwickdey.LiveServer` — adds the familiar **Go Live** workflow and live reload for web projects. citeturn693347search0turn693347search9
- `ms-python.python`
- `ms-python.vscode-pylance`
- `dbaeumer.vscode-eslint`
- `esbenp.prettier-vscode`
- `redhat.vscode-yaml`
- `golang.go`
- `PKief.material-icon-theme`

code-server supports extension installation from its Extensions UI and from the command line; its default gallery is Open VSX. citeturn317726search2turn613191search2

## Real-time suggestions

The previous build only had Monaco, so it could not provide the full extension-host/language-server behavior of VS Code. This build runs code-server, which is a VS Code-compatible server with the VS Code extension host. HTML/CSS/JavaScript language features are built in, and Python/Pylance adds Python IntelliSense, diagnostics and navigation.

## Tkinter

Python and `python3-tk` are installed in the image. A normal Tkinter program can run in the terminal/process environment, but native desktop windows do not automatically become browser canvases. That needs a separate GUI/display bridge.

## Security

code-server's own documentation warns that exposing it without authentication can allow terminal access to the machine. citeturn613191search1turn280460search1

For a personal Shard Cloud app, you can leave `CODE_SERVER_PASSWORD` empty when another access-control layer protects the app. For a directly public URL, set `CODE_SERVER_PASSWORD` as a secret.

## References

- code-server current release line: 4.138.0 (September 19, 2026). citeturn317726search0turn317726search1
- code-server supports a configurable bind address and `$PORT`. citeturn130622search2
- code-server's built-in port proxy serves development services at `/proxy/<port>/`. citeturn280460search0
