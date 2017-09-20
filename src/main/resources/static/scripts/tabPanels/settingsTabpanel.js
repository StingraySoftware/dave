
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
                        '<h2>' +
                          'General Settings:' +
                        '</h2>' +
                        '<h3>' +
                          'Main settings:' +
                        '</h3>' +
                        '<div class="settingsContainer">' +
                          '<p>Minimum points to plot: <input id="MIN_PLOT_POINTS_' + this.id + '" class="inputMIN_PLOT_POINTS" type="text" name="MIN_PLOT_POINTS_' + this.id + '" placeholder="' + CONFIG.MIN_PLOT_POINTS + '" value="' + CONFIG.MIN_PLOT_POINTS + '" /></p>' +
                          '<p>Maximum points to plot: <input id="MAX_PLOT_POINTS_' + this.id + '" class="inputMAX_PLOT_POINTS" type="text" name="MAX_PLOT_POINTS_' + this.id + '" placeholder="' + CONFIG.MAX_PLOT_POINTS + '" value="' + CONFIG.MAX_PLOT_POINTS + '" /></p>' +
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
                        '<h3>' +
                          'Power density spectrum settings:' +
                        '</h3>' +
                        '<div class="settingsContainer">' +
                          '<p>Minimum segment size: BinSize *<input id="MIN_SEGMENT_MULTIPLIER_' + this.id + '" class="inputMIN_SEGMENT_MULTIPLIER" type="text" name="MIN_SEGMENT_MULTIPLIER_' + this.id + '" placeholder="' + CONFIG.MIN_SEGMENT_MULTIPLIER + '" value="' + CONFIG.MIN_SEGMENT_MULTIPLIER + '" /></p>' +
                          '<p>Default segment size: TotalTime /<input id="DEFAULT_SEGMENT_DIVIDER_' + this.id + '" class="inputDEFAULT_SEGMENT_DIVIDER" type="text" name="DEFAULT_SEGMENT_DIVIDER_' + this.id + '" placeholder="' + CONFIG.DEFAULT_SEGMENT_DIVIDER + '" value="' + CONFIG.DEFAULT_SEGMENT_DIVIDER + '" /></p>' +
                        '</div>');

  this.$container.find(".inputMIN_PLOT_POINTS").on('change', function(){
    CONFIG.MIN_PLOT_POINTS = getInputIntValueCropped(currentObj.$container.find(".inputMIN_PLOT_POINTS"), CONFIG.MIN_PLOT_POINTS, 2, CONFIG.MAX_PLOT_POINTS);
  });

  this.$container.find(".inputMAX_PLOT_POINTS").on('change', function(){
    CONFIG.MAX_PLOT_POINTS = getInputIntValueCropped(currentObj.$container.find(".inputMAX_PLOT_POINTS"), CONFIG.MAX_PLOT_POINTS, CONFIG.MIN_PLOT_POINTS, 9999999);
    updateServerConfig();
  });

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
