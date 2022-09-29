#!/bin/sh

# Install opa
curl -L -o opa https://github.com/open-policy-agent/opa/releases/download/v0.44.0/opa_linux_amd64 \
    && chmod +x opa \
    && mv opa /usr/local/bin;
