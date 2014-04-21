#!/bin/bash
cd server/
hash npm 2>/dev/null || { echo >&2 "Please install 'npm' before running this script."; exit 1; }
npm config set registry http://registry.npmjs.org/
if [ `npm ls | grep socket.io | wc -l` -eq 0 ]
	then
	echo 'Installing socket.io https://github.com/learnboost/socket.io/'
	npm install socket.io
fi
if [ `npm ls | grep orm | wc -l` -eq 0 ]
	then
	echo 'Installing node-orm2 https://github.com/dresende/node-orm2'
	npm install orm
	echo 'Installing mysql db driver https://github.com/felixge/node-mysql'
	npm install mysql@2.0.0-alpha8 --save
fi
cd ../build
echo 'Building...'
./build.sh

