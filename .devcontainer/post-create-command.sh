#!/bin/sh

# Install opa
curl -L -o opa https://github.com/open-policy-agent/opa/releases/download/v0.44.0/opa_linux_amd64 \
    && chmod +x opa \
    && mv opa /usr/local/bin;

curl -L -o tf-summarize.zip https://github.com/dineshba/tf-summarize/releases/download/v0.2.3/tf-summarize_linux_amd64.zip \
    && unzip tf-summarize.zip tf-summarize \
    && chmod +x tf-summarize \
    && mv tf-summarize /usr/local/bin \
    && rm tf-summarize.zip;
