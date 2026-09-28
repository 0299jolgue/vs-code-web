FROM codercom/code-server:4.138.0

USER root

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
       ca-certificates \
       curl \
       git \
       python3 \
       python3-pip \
       python3-venv \
       python3-tk \
       build-essential \
       golang-go \
       ruby-full \
       php-cli \
       bash \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/coder/workspace /home/coder/.config/code-server /home/coder/.local/share/code-server/User \
    && chown -R coder:coder /home/coder/workspace /home/coder/.config/code-server /home/coder/.local

COPY --chown=coder:coder code-server-settings.json /home/coder/.local/share/code-server/User/settings.json
COPY --chown=coder:coder start.sh /usr/local/bin/shard-vscode-start
RUN chmod +x /usr/local/bin/shard-vscode-start

USER coder
ENV PORT=80 \
    HOST=0.0.0.0 \
    XDG_CONFIG_HOME=/home/coder/.config \
    XDG_DATA_HOME=/home/coder/.local/share \
    VSCODE_PROXY_URI=./proxy/{{port}}/ \
    DO_NOT_TRACK=1

# Extensions that make the browser IDE behave like a normal VS Code setup.
RUN code-server --install-extension ritwickdey.LiveServer \
    && code-server --install-extension ms-python.python \
    && code-server --install-extension ms-python.vscode-pylance \
    && code-server --install-extension dbaeumer.vscode-eslint \
    && code-server --install-extension esbenp.prettier-vscode \
    && code-server --install-extension redhat.vscode-yaml \
    && code-server --install-extension golang.go \
    && code-server --install-extension PKief.material-icon-theme

WORKDIR /home/coder/workspace

EXPOSE 80

ENTRYPOINT ["/usr/local/bin/shard-vscode-start"]
