module.exports = {
  environment : {
    enabled : 'true',
    path : '../../../dave/resources/bash/activate_and_launch.bash'
  },
  python : {
    enabled : 'false',
    path : '../resources/python/server.py',
    url : 'http://localhost:5000'
  },
  logDebugMode : 'false',
  logsPath : '$HOME/.dave/flaskserver.log',
  splash_path : '/../../../dave/resources/templates/splash_page.html'
};
