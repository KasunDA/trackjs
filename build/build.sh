#!/bin/bash
cat `find ../* | grep "dist/socket.io.js"` ../client/jquery.js ../client/track.js > ../client/trackjsfull.js;
