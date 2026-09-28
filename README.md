# VS Code Web for Shard Cloud

Browser IDE built around a **single public port: 80**.

## Included

- Monaco editor with tabs, syntax highlighting, minimap and save shortcuts.
- Workspace Explorer with file/folder creation.
- Browser terminal over WebSocket.
- Server-side Run for Python, Node.js, TypeScript via tsx, PHP, Ruby, Go and shell when those runtimes exist.
- Go Live static preview served through the same public port.
- Open VSX search panel.
- Runtime/process status.
- Starter project on first boot.

## Shard Cloud

The service defaults to:

- PORT=80
- HOST=0.0.0.0

Do not expose 8080. The preview route is /preview/<session>/... on the same port 80.

Start with:

    npm install
    npm start

The included Procfile uses node server.js.

## Security

The Run button and terminal execute commands as the web-server OS account. This is a trusted/personal workspace design, not a safe multi-tenant code-execution sandbox. For public users, put every workspace inside an isolated container/VM/sandbox with CPU, memory, process, filesystem and network limits.

## Tkinter and GUI apps

Python execution is supported. Native Tkinter windows are not automatically turned into browser UI. Browser delivery of desktop GUI apps requires an additional display bridge such as X11 + VNC/WebSocket or a dedicated GUI compatibility layer.

## VS Code extensions

The Extensions panel searches Open VSX. The current project is Monaco-based and does not yet ship the complete VS Code extension host. Web extensions/native extensions need an extension-host layer to execute.
