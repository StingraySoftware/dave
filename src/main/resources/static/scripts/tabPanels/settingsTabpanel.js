
//Adds new Settings Tab Panel if not created or show settingsTab else.
function showSettingsTabPanel(navBarList, panelContainer){
  var settingsTabId = "Settings";
  var settingsTab = getTabForSelector(settingsTabId);
  if (getTabForSelector(settingsTabId) == null) {
    settingsTab = new SettingsTabPanel(settingsTabId, "TabPanelTemplate", "NavItem_" + tabPanels.length, theService, navBarList, panelContainer);
  } else {
    settingsTab.show();
  }
}

function SettingsTabPanel (id, classSelector, navItemClass, service, navBarList, panelContainer) {

  var currentObj = this;
  tabPanels.push(this); // Insert on tabPanels here for preparing access to getTabForSelector from plots

  TabPanel.call(this, id, classSelector, navItemClass, navBarList, panelContainer);
  this.setTitle("Settings");

  this.$container = this.$html.find(".toolPanelContainer");
  this.$container.html('<div class="aboutDaveDiv floatRight">' +
                          '<a href="#" class="btnAboutDave InfoText">About DAVE <i class="fa fa-info-circle" aria-hidden="true"></i></a>' +
                        '</div>' +
                        '<div class="row" style="margin: 24px;">' +
                          '<h2>' +
                            'General Settings:' +
                          '</h2>' +
                          '<div class="col-xs-6">' +
                            '<h3>' +
                              'Main settings:' +
                            '</h3>' +
                            '<div class="settingsContainer mainSettings">' +
                              /*'<div class="autoFilterType" style="display: inline-flex;">' +
                                '<p>Auto Filtering:' +
                                '<fieldset style="margin-left: 8px;">' +
                                  '<label for="' + this.id + '_Time">Time range</label>' +
                                  '<input type="radio" name="' + this.id + '_AutoFilter" id="' + this.id + '_Time" value="Time" ' + getCheckedState(!CONFIG.AUTO_BINSIZE) + '>' +
                                  '<label for="' + this.id + '_BinSize">Bin size</label>' +
                                  '<input type="radio" name="' + this.id + '_AutoFilter" id="' + this.id + '_BinSize" value="BinSize" ' + getCheckedState(CONFIG.AUTO_BINSIZE) + '>' +
                                '</fieldset><p>' +
                              '</div>' +*/
                            '</div>' +
                          '</div>' +
                          '<div class="col-xs-6">' +
                            '<h3>' +
                              'Power density spectrum settings:' +
                            '</h3>' +
                            '<div class="settingsContainer">' +
                              '<p>Minimum segment size: BinSize *<input id="MIN_SEGMENT_MULTIPLIER_' + this.id + '" class="inputMIN_SEGMENT_MULTIPLIER" type="text" name="MIN_SEGMENT_MULTIPLIER_' + this.id + '" placeholder="' + CONFIG.MIN_SEGMENT_MULTIPLIER + '" value="' + CONFIG.MIN_SEGMENT_MULTIPLIER + '" /></p>' +
                              '<p>Default segment size: TotalTime /<input id="DEFAULT_SEGMENT_DIVIDER_' + this.id + '" class="inputDEFAULT_SEGMENT_DIVIDER" type="text" name="DEFAULT_SEGMENT_DIVIDER_' + this.id + '" placeholder="' + CONFIG.DEFAULT_SEGMENT_DIVIDER + '" value="' + CONFIG.DEFAULT_SEGMENT_DIVIDER + '" /></p>' +
                            '</div>' +
                            '<h3>' +
                              'Advanced settings:' +
                            '</h3>' +
                            '<div class="settingsContainer advSettings">' +
                            '</div>' +
                        '</div>' +
                      '</div>' +
                      '<p class="InfoText">Settings changed here only applies to new tabs. You can save the workspace for reusing this settings later, or edit config.js file for updating the default settings.</p>' +
                    '</br></br></br>');

  var $mainSettings = this.$container.find(".mainSettings");
  var $advSettingss = this.$container.find(".advSettings");

  $mainSettings.append(getRangeBox ("MIN_PLOT_POINTS_" + this.id, "inputMIN_PLOT_POINTS",
                                    "Minimum points to plot", CONFIG.MIN_PLOT_POINTS, 2, CONFIG.MAX_PLOT_POINTS,
                                    function(value, input) { CONFIG.MIN_PLOT_POINTS = value; updateServerConfig(); }));

  $mainSettings.append(getRangeBox ("MAX_PLOT_POINTS_" + this.id, "inputMAX_PLOT_POINTS",
                                    "Maximum points to plot", CONFIG.MAX_PLOT_POINTS, CONFIG.MIN_PLOT_POINTS, 9999999,
                                    function(value, input) { CONFIG.MAX_PLOT_POINTS = value; updateServerConfig(); }));

  $mainSettings.append(getRangeBox ("MAX_TIME_RESOLUTION_DECIMALS_" + this.id, "inputMAX_TIME_RESOLUTION_DECIMALS",
                                    "Maximun time resolution", CONFIG.MAX_TIME_RESOLUTION_DECIMALS, 1, 9,
                                    function(value, input) { CONFIG.MAX_TIME_RESOLUTION_DECIMALS = value; updateServerConfig(); }));

  $mainSettings.append(getRangeBox ("MAX_TIME_RESOLUTION_DECIMALS_" + this.id, "inputMAX_TIME_RESOLUTION_DECIMALS",
                                    "Time numbers decimals", CONFIG.MAX_TIME_RESOLUTION_DECIMALS, 1, 9,
                                    function(value, input) { CONFIG.MAX_TIME_RESOLUTION_DECIMALS = value; updateServerConfig(); }));

  $mainSettings.append(getRangeBox ("DEFAULT_NUMBER_DECIMALS_" + this.id, "inputDEFAULT_NUMBER_DECIMALS",
                                    "Default numbers decimals", CONFIG.DEFAULT_NUMBER_DECIMALS, 1, 9,
                                    function(value, input) { CONFIG.DEFAULT_NUMBER_DECIMALS = value; updateServerConfig(); }));

  $mainSettings.append(getRangeBox ("FRACEXP_LIMIT_" + this.id, "inputFRACEXP_LIMIT float",
                                    "Minimum exposure fraction allowed", CONFIG.FRACEXP_LIMIT, 0.0, 1.0,
                                    function(value, input) { CONFIG.FRACEXP_LIMIT = value; updateServerConfig(); }));

  $mainSettings.append(getRangeBox ("ENERGY_FILTER_STEP_" + this.id, "inputENERGY_FILTER_STEP float",
                                    "Stepping value for energy filters in keV (default: 5eV)", CONFIG.ENERGY_FILTER_STEP, 0.0001, 0.1,
                                    function(value, input) { CONFIG.ENERGY_FILTER_STEP = value; updateServerConfig(); }));

  $advSettingss.append(getTextBox ("TIME_COLUMN_" + this.id, "inputTIME_COLUMN",
                                    "Time column name on HDU", CONFIG.TIME_COLUMN,
                                    function(value, input) { CONFIG.TIME_COLUMN = value; updateServerConfig(); }));

  $advSettingss.append(getTextBox ("GTI_STRING_" + this.id, "inputGTI_STRING",
                                    "HDU names supported as GTI tables (separated by commas without spaces)", CONFIG.GTI_STRING,
                                    function(value, input) { CONFIG.GTI_STRING = value; updateServerConfig(); }));

  $advSettingss.append(getBooleanBox ("Avoid set background file if lightcurve bck data is allready substracted",
                                    "chkDENY_BCK_IF_SUBS", CONFIG.DENY_BCK_IF_SUBS,
                                    function(enabled) { CONFIG.DENY_BCK_IF_SUBS = enabled; updateServerConfig(); }));

  $advSettingss.append(getBooleanBox ("Show server logs on GUI Log tab",
                                    "chkLOG_TO_SERVER_ENABLED", CONFIG.LOG_TO_SERVER_ENABLED,
                                    function(enabled) { CONFIG.LOG_TO_SERVER_ENABLED = enabled; updateServerConfig(); }));

  //Add the server log level radio buttons
  // PYTHON SERVER LOG LEVEL -> ALL = -1, DEBUG = 0, INFO = 1, WARN = 2, ERROR = 3, NONE = 4
  $advSettingss.append(getRadioControl(currentObj.id,
                                    "Server logging level",
                                    "serverLogLevel",
                                    [
                                      { id:"All", label:"All", value:"-1"},
                                      { id:"Debug", label:"Debug", value:"0"},
                                      { id:"Info", label:"Info", value:"1"},
                                      { id:"Warn", label:"Warn", value:"2"},
                                      { id:"Error", label:"Error", value:"3"},
                                      { id:"None", label:"None", value:"4"},
                                    ],
                                    CONFIG.LOG_LEVEL + "",
                                    function(value, id) {
                                      CONFIG.LOG_LEVEL = parseInt(value);
                                      updateServerConfig();
                                    }));

  /*var $autoFilterRadios = this.$container.find(".autoFilterType").find("input[type=radio][name=" + this.id + "_AutoFilter]");
  $autoFilterRadios.checkboxradio();
  this.$container.find(".autoFilterType").find("fieldset").controlgroup();
  $autoFilterRadios.change(function() {
    CONFIG.AUTO_BINSIZE = this.value == "BinSize";
  });*/

  this.$container.find(".inputMIN_SEGMENT_MULTIPLIER").on('change', function(){
    CONFIG.MIN_SEGMENT_MULTIPLIER = getInputIntValueCropped(currentObj.$container.find(".inputMIN_SEGMENT_MULTIPLIER"), CONFIG.MIN_SEGMENT_MULTIPLIER, 1, 100);
  });

  this.$container.find(".inputDEFAULT_SEGMENT_DIVIDER").on('change', function(){
    CONFIG.DEFAULT_SEGMENT_DIVIDER = getInputIntValueCropped(currentObj.$container.find(".inputDEFAULT_SEGMENT_DIVIDER"), CONFIG.DEFAULT_SEGMENT_DIVIDER, 1, 100);
  });

  this.$container.find(".btnAboutDave").click(function () {

    var version = !isNull(BUILD_VERSION) ? BUILD_VERSION : "Unknown";

    showMsg("About DAVE",
            "<p>DAVE stands for Data Analysis of Variable Events, which is a GUI built on top of the Stingray library. It is intended to be used by astronomers for time-series analysis in general, and analysis of variable sources in particular.<br>The goal is to enable scientific exploration and flexible analysis flows where users can insert their own algorithms to compare the effects of such changes.</p>" +
            "<p>More information about DAVE in: <br>https://github.com/StingraySoftware/dave</p>" +
            "<p>© 2016 Timelab Technologies Ltd.</p>" +
            "<p style='float: right; font-size: 0.85em;'>DAVE Version: " + version + "</p>");
  });

  log("SettingsTabPanel ready! id: " + this.id);
  return this;
}
