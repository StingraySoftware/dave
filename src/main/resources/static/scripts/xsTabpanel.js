
//Adds new Cross Spectrum Tab Panel
function addXdTabPanel(navBarList, panelContainer, plots){
  tab = new XSTabPanel("Tab_" + tabPanels.length, "TabPanelTemplate", "NavItem_" + tabPanels.length, theService, navBarList, panelContainer, plots);
  tabPanels.push(tab);
}

function XSTabPanel (id, classSelector, navItemClass, service, navBarList, panelContainer, plots) {

  var currentObj = this;

  TabPanel.call(this, id, classSelector, navItemClass, service, navBarList, panelContainer);

  //Set the selected plot configs
  this.plots = plots;

  this.setTitle("XSpectrum");

  //Preapares XS toolpanel data
  this.toolPanel.clearFileSelectors();
  for (i in this.plots){
    var plot = this.plots[i];
    this.toolPanel.addSelectedFile(plot.plotConfig.styles.title, plot.plotConfig.filename);
  }

  log("XSTabPanel ready! id: " + this.id);
}
