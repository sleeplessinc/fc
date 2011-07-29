#!/bin/bash



killall -9 forever
killall -9 node

cd ~/fc/bruml
forever server.js &> log.txt &

cd ~/fc/etherpad-lite/node
forever server.js &> log.txt &

cd ~/fc
forever app.js &> log.txt &

