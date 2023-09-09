#!/bin/bash
source ci_config.env
ssh ${REMOTE_HOST} "curl -v -X POST localhost:8080/internal/reload-posts"