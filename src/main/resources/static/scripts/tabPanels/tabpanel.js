var tabPanels = [];

function TabPanel (id, classSelector, navItemClass, navBarList, panelContainer) {

  var currentObj = this;

  //TAB_PANEL ATTRIBUTES
  this.id = id;
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
    log("TabPanel shown id: " + this.id);
  }

  this.addCloseButton = function () {
    var closeTabBtn = $('<i class="fa fa-times closeIcon closeTabPanel" aria-hidden="true"></i>')
    this.$navItem.find("." + this.navItemClass).append(closeTabBtn);
    closeTabBtn.click(function () {
      currentObj.close();
    });
  }

  this.close = function () {
    log("TabPanel closed id: " + this.id);
    removeTab(this.id);
  }

  this.containsId = function (id) {
    return this.id == id;
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
