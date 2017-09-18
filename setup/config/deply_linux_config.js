module.exports = {
  environment : {
    enabled : 'true',
    path : '../resources/bash/activate_and_launch.bash'
  },
  python : {
    enabled : 'false',
    path : '../resources/python/server.py',
    url : 'http://localhost:5000'
  },
  logDebugMode : 'true',
  logsPath : '$HOME/.dave/flaskserver.log',
  splash_path : '/../resources/templates/splash_page.html'
};
