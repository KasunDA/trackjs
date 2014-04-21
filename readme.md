trackjs is a small project I created to learn node.js with socket.io. It allows you to precisely track user activity on web interfaces.  
Just by embedding the client script to a page or to the user's browser, you can watch live the client browsing. The following actions are catched :  
- page visited and their content  
- mouse and scroll actions  
- input on forms  
- page change  
- navigator dimensions and position on screen  
  
Due to web browser having different behaviours, the preview might not be 100% accurate. Some events are not yet catched (see TODO).  
  
REQUIREMENTS  
------------  
- nodejs  
- rpm  
- mysql-server (local or remote server)  
- modern web browser supporting HTML5/CSS3  
  
DEPENDENCIES  
------------  
- socket.io https://github.com/learnboost/socket.io/  
- node-orm2 https://github.com/dresende/node-orm2  
- mysql node.js driver https://github.com/felixge/node-mysql  
- jquery  
  
HOW TO INSTALL  
--------------  
Configure the server :  
- change the server/db.js db_config to point to your mysql database  
- change the server/server.js adminPass to the password you wanna use for the admin panel  
- run ./install.sh  
- run 'server/server.js -generate-db' with nodejs  
  
Configure the panel :  
- change the panel/index.html socket.io js script include to point to your trackjs server   
- change the panel/netword-panel.js panel_config to point to your trackjs server  
- host the panel/ directory anywhere (possibly locally if you plan to be the only admin)  
  
Build the client script :  
- change the client/track.js server_config to point to your trackjs server  
- go to the build/ directory and launch ./build  
  
Deploy :  
- include the client/trackjsfull.js file on the website pages where you want the tracking to occur  
- visit the panel/ directory with your web browser to view past and live sessions   
  
By default the server listens to ports 7455 and 7456  
  
SERVER OPTIONS  
--------------  
--generate-db : generates necessary databases and tables  
--no-db : disable database storage/lookup. Sessions can only be viewed live and won't be stored  
