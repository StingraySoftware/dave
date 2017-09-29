var tabPanels = [];
var tabPanelsLoadFns = [];

function TabPanel (id, classSelector, navItemClass, navBarList, panelContainer) {

  var currentObj = this;

  //TAB_PANEL ATTRIBUTES
  this.id = id + "_" + (new Date()).getTime();
  this.classSelector = classSelector;
  this.navItemClass = navItemClass;
  this.$html = cloneHtmlElement(id, classSelector);
  this.$navItem = $('<li><a class="' + navItemClass + '" href="#">Tab ' + tabPanels.length + '</a></li>')

  //TAB_PANEL METHODS AND EVENTS HANDLERS
  this.setTitle = function ( title ) {
    this.$navItem.find("." + this.navItemClass).html(title);
    this.addCloseButton();
    log("TabPanel setTitle id: " + this.id + " title: " + title);
  }

  this.show = function () {
    this.$navItem.parent().find(".active").removeClass("active");
    this.$navItem.addClass("active");
    $(".TabPanel").hide();
    this.$html.show();
    $(window).trigger("resize"); //Forces plots to fit window size
  }

  this.addCloseButton = function () {
    var closeTabBtn = $('<i class="fa fa-times closeIcon closeTabPanel" aria-hidden="true" data-toggle="tooltip" title="Close tab"></i>')
    this.$navItem.find("." + this.navItemClass).append(closeTabBtn);
    closeTabBtn.click(function () {
      currentObj.close();
    });
  }

  this.close = function () {
    log("TabPanel closed id: " + this.id);
    removeTab(this.id);
  }

  this.addPlot = function (plot, refreshData){
    this.outputPanel.plots.push(plot);
    this.projectConfig.plots.push(plot);
    this.outputPanel.appendPlot(plot, refreshData);
  };

  this.containsId = function (id) {
    return this.id == id;
  }

  this.getConfig = function () {
    return null;
  }

  this.destroy = function () {
    try {
      delete this.classSelector;
      delete this.navItemClass;
      delete this.service;
      this.$html.remove();
      delete this.$html;
      this.$navItem.remove();
      delete this.$navItem;

      delete this.id;
    } catch (ex) {
      log("Destroy tab " + this.id + " error: " + ex);
    }
  }

  //TAB_PANEL INITIALIZATION
  this.$navItem.find("." + this.navItemClass).click(function () {
    currentObj.show();
  });

  this.$navItem.insertBefore(".addTabPanelLi");
  this.addCloseButton();
  panelContainer.append(this.$html);
  this.show();

  log("TabPanel ready! id: " + this.id);
  return this;
}


//STATIC TAB_PANEL METHODS

function getTabForSelector (selectorId) {
  for (t in tabPanels) {
    if (tabPanels[t].containsId(selectorId)) {
        return tabPanels[t];
    }
  }
  return null;
}

function removeTab (id) {
  var idx = -1;

  for (t in tabPanels) {
    var tab = tabPanels[t];

    if (tab.id == id) {
        idx = t;
        break;
    }
  }

  if (idx > -1){
    tabPanels[idx].destroy();
    tabPanels.splice(idx,1);

    if (tabPanels.length > 0) {
      tabPanels[0].show()
    } else {
      $("#navbar").find(".addTabPanel").click();
    }
  }
}

function clearTabs () {
  while (tabPanels.length > 0) {
    tabPanels[0].destroy();
    tabPanels.splice(0,1);
  }
}

function getTabsConfigs () {
  var tabsConfigs = [];

  var generalConfig = $.extend ({ type: "CONFIG" }, CONFIG );
  tabsConfigs.push(generalConfig);

  for (t in tabPanels) {
    var tabConfig = tabPanels[t].getConfig();
    if (!isNull(tabConfig)) {
        tabsConfigs.push(tabConfig);
    }
  }
  return tabsConfigs;
}

function setTabConfigs (tabsConfigs) {

  //Clears current environment
  clearTabs();

  //Fill the tabLoadList functions array with each tab callback function
  var tabLoadFnList = [];
  for (tc in tabsConfigs) {
    var tabConfig = tabsConfigs[tc];
    if (!isNull(tabConfig.type)) {
      tabLoadFnList.push(makeTabCallbackFunc(tabConfig));
    }
  }

  //Runs waterfall tabs loading, avoid parallel load beacuse can break the OS sockets
  async.waterfall(tabLoadFnList, function (err, result) {
      if (!isNull(err)){
        log("onLoadWorkSpaceClicked error: " + err);
      } else {
        log("onLoadWorkSpaceClicked success!!");
      }

      waitingDialog.hide({ ignoreCalls: true });
  });
}

function makeTabCallbackFunc (tabConfig) {
    //Returns a function used by Async for creating new tab from tabConfig
    return function (callback) {
        try {
              var tab = null;

              if (tabConfig.type == "CONFIG") {

                //Sets general configuration
                delete tabConfig.type;
                $.extend (CONFIG, tabConfig);
                callback();

              } else {

                //Calls the load tab function subscribed on tabPanelsLoadFns
                if (!isNull(tabPanelsLoadFns[tabConfig.type])) {
                  tab = tabPanelsLoadFns[tabConfig.type](tabConfig);
                  if (!isNull(tab)) {
                    tab.setConfig(tabConfig, callback);
                  } else {
                    showError("Error loading tab: " + tabConfig.id, null, { ignoreCalls: true });
                  }
                } else {
                  showError("Error tab type not subscribed: " + tabConfig.type, null, { ignoreCalls: true });
                }

              }

            } catch (e) {
              showError("Error loading tab ...", e, { ignoreCalls: true });
              callback (e);
            }
          };
}
