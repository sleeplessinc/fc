#!/bin/bash

type -P node-inspector &>/dev/null || { 
  echo "You need to install node-inspector to run the tests!" >&2
  echo "You can install it with npm" >&2
  echo "Run: npm install node-inspector" >&2
  exit 1 
}

node-inspector &

echo "If you new to node-inspector, take a look at this video: http://youtu.be/AOnK3NVnxL8"

if [ -d "../bin" ]; then
  cd "../"
fi

cd "node"
node --debug server.js
