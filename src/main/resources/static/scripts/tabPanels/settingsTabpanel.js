
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
  this.$container.html('<h2>' +
                          'General Settings:' +
                        '</h2>' +
                        '<h3>' +
                          'Main settings:' +
                        '</h3>' +
                        '<div class="settingsContainer">' +
                          '<p>Minimun points to plot: <input id="MIN_PLOT_POINTS_' + this.id + '" class="inputMIN_PLOT_POINTS" type="text" name="MIN_PLOT_POINTS_' + this.id + '" placeholder="' + CONFIG.MIN_PLOT_POINTS + '" value="' + CONFIG.MIN_PLOT_POINTS + '" /></p>' +
                          '<p>Maximun points to plot: <input id="MAX_PLOT_POINTS_' + this.id + '" class="inputMAX_PLOT_POINTS" type="text" name="MAX_PLOT_POINTS_' + this.id + '" placeholder="' + CONFIG.MAX_PLOT_POINTS + '" value="' + CONFIG.MAX_PLOT_POINTS + '" /></p>' +
                        '</div>' +
                        '<h3>' +
                          'Power density spectrum settings:' +
                        '</h3>' +
                        '<div class="settingsContainer">' +
                          '<p>Minimun segment size: BinSize *<input id="MIN_SEGMENT_MULTIPLIER_' + this.id + '" class="inputMIN_SEGMENT_MULTIPLIER" type="text" name="MIN_SEGMENT_MULTIPLIER_' + this.id + '" placeholder="' + CONFIG.MIN_SEGMENT_MULTIPLIER + '" value="' + CONFIG.MIN_SEGMENT_MULTIPLIER + '" /></p>' +
                          '<p>Default segment size: TotalTime /<input id="DEFAULT_SEGMENT_DIVIDER_' + this.id + '" class="inputDEFAULT_SEGMENT_DIVIDER" type="text" name="DEFAULT_SEGMENT_DIVIDER_' + this.id + '" placeholder="' + CONFIG.DEFAULT_SEGMENT_DIVIDER + '" value="' + CONFIG.DEFAULT_SEGMENT_DIVIDER + '" /></p>' +
                        '</div>');

  this.$container.find(".inputMIN_PLOT_POINTS").on('change', function(){
    CONFIG.MIN_PLOT_POINTS = getInputIntValueCropped(currentObj.$container.find(".inputMIN_PLOT_POINTS"), CONFIG.MIN_PLOT_POINTS, 2, CONFIG.MAX_PLOT_POINTS);
  });

  this.$container.find(".inputMAX_PLOT_POINTS").on('change', function(){
    CONFIG.MAX_PLOT_POINTS = getInputIntValueCropped(currentObj.$container.find(".inputMAX_PLOT_POINTS"), CONFIG.MAX_PLOT_POINTS, CONFIG.MIN_PLOT_POINTS, 9999999);
  });

  this.$container.find(".inputMIN_SEGMENT_MULTIPLIER").on('change', function(){
    CONFIG.MIN_SEGMENT_MULTIPLIER = getInputIntValueCropped(currentObj.$container.find(".inputMIN_SEGMENT_MULTIPLIER"), CONFIG.MIN_SEGMENT_MULTIPLIER, 1, 100);
  });

  this.$container.find(".inputDEFAULT_SEGMENT_DIVIDER").on('change', function(){
    CONFIG.DEFAULT_SEGMENT_DIVIDER = getInputIntValueCropped(currentObj.$container.find(".inputDEFAULT_SEGMENT_DIVIDER"), CONFIG.DEFAULT_SEGMENT_DIVIDER, 1, 100);
  });

  log("SettingsTabPanel ready! id: " + this.id);
}
