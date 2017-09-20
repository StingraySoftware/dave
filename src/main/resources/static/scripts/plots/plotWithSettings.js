//Plot with settings panel

function PlotWithSettings(id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable, projectConfig) {

  var currentObj = this;

  Plot.call(this, id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable);

  //Plot with settings attributes:
  this.settingsVisible = false;

  this.settingsPanel = $('<div class="settings">' +
                            '<div class="row title"><h3>Settings:</h3></div>' +
                            '<div class="row">' +
                              '<div class="settingsCol leftCol col-xs-6">' +
                              '</div>' +
                              '<div class="settingsCol rightCol col-xs-6">' +
                              '</div>' +
                            '</div>' +
                          '</div>');
  this.settingsPanel.hide();
  this.$html.prepend(this.settingsPanel);

  this.btnSettings = $('<button class="btn btn-default btnSettings' + this.id + '" data-toggle="tooltip" title="Open plot settings"><i class="fa fa-cog" aria-hidden="true"></i></button>');
  this.$html.find(".plotTools").append(this.btnSettings);
  this.btnSettings.click(function(event){
    currentObj.showSettings();
  });

  this.btnBack = $('<button class="btn btn-default btnBack' + this.id + '" data-toggle="tooltip" title="Close plot settings"><i class="fa fa-arrow-left" aria-hidden="true"></i></button>');
  this.btnBack.hide();
  this.$html.find(".plotTools").append(this.btnBack);
  this.btnBack.click(function(event){
    currentObj.hideSettings();
    currentObj.refreshData();
  });

  //PlotWithSettings plot methods:
  this.setSettingsTitle = function (title) {
    this.settingsPanel.find(".title").find("h3").first().html(title);
  }

  this.showSettings = function(){
    if (!this.settingsVisible) {
      this.settingsVisible = true;
      this.setHoverDisablerEnabled(false);
      this.setLegendText("");
      var height = parseInt(this.$html.find(".plot").height());
      this.$html.find(".plot").hide();
      this.$html.find(".plotTools").children().hide();

      var title = 'Settings:';
      if (!isNull(this.plotConfig.styles.title)){
        title = this.plotConfig.styles.title + ' Settings:';
      }
      this.setSettingsTitle(title);

      this.addBinSizeSelectorToSettings(".leftCol");

      this.addSettingsControls();

      if (!this.$html.hasClass("fullWidth") && this.settingsPanel.find(".rightCol").children().length == 0){

        // If not is fullWidth and rightCol has no elements sets the width of cols to 100%
        this.settingsPanel.find(".settingsCol").switchClass("col-xs-6", "col-xs-12");

      } else if (this.$html.hasClass("fullWidth")){

        // If is fullWidth sets the width of cols to 50%
        this.settingsPanel.find(".settingsCol").switchClass("col-xs-12", "col-xs-6");
      }

      this.btnBack.show();
      this.settingsPanel.show();
      this.settingsPanel.css({ 'height': height + 'px' });
    }
  }

  this.clearSettings = function(){
    var settingsVisible = this.settingsVisible;
    this.settingsVisible = false;
    this.settingsPanel.find(".leftCol").html("");
    this.settingsPanel.find(".rightCol").html("");
    this.showSettings();
    if (!settingsVisible) {
      this.hideSettings();
    }
  }

  this.addSettingsControls = function(){
    //Just for notify inherited plots that setting panel was shown, must be overriden.
  }

  this.onSettingsCreated = function(){
    //Just for notify inherited plots that setting panel was created, must be overriden.
  }

  this.hideSettings = function(){
    if (this.settingsVisible) {
      this.settingsVisible = false;
      this.setHoverDisablerEnabled(true);
      this.settingsPanel.hide();
      this.$html.find(".plot").show();
      this.$html.find(".plotTools").children().show();
      this.btnBack.hide();
    }
  }

  this.addAxesTypeControlsToSettings = function (columnClass) {
    if (!isNull(this.plotConfig.xAxisType) && !isNull(this.plotConfig.yAxisType)) {

      var options = [
        { id:"linear", label:"Linear", value:"linear"},
        { id:"log", label:"Logarithmic", value:"log"}
      ];

      // Creates the X axis type radio buttons
      this.xAxisRadios = getRadioControl(this.id,
                                        this.plotConfig.styles.labels[0] + ' axis type',
                                        "pdsXAxisType",
                                        options,
                                        this.plotConfig.xAxisType,
                                        function(value, id) {
                                          currentObj.plotConfig.xAxisType = value;
                                        });
      this.xAxisRadios.addClass("AxisType");
      this.settingsPanel.find(columnClass).append(this.xAxisRadios);

      // Creates the Y axis type radio buttons
      this.yAxisRadios = getRadioControl(this.id,
                                        this.plotConfig.styles.labels[1] + ' axis type',
                                        "pdsYAxisType",
                                        options,
                                        this.plotConfig.yAxisType,
                                        function(value, id) {
                                          currentObj.plotConfig.yAxisType = value;
                                        });
      this.yAxisRadios.addClass("AxisType");
      this.settingsPanel.find(columnClass).append(this.yAxisRadios);

      if (!isNull(this.plotConfig.zAxisType)) {
        // Creates the Z axis type radio buttons
        this.zAxisRadios = getRadioControl(this.id,
                                          this.plotConfig.styles.labels[2] + ' axis type',
                                          "pdsZAxisType",
                                          options,
                                          this.plotConfig.zAxisType,
                                          function(value, id) {
                                            currentObj.plotConfig.zAxisType = value;
                                          });
        this.zAxisRadios.addClass("AxisType");
        this.settingsPanel.find(columnClass).append(this.zAxisRadios);
      }

    } else {
      logErr ("PlotWithSettings id: " + this.id + " - addAxesTypeControlsToSettings ERROR: plotConfig.xAxisType or plotConfig.yAxisType not initialized!");
    }
  }

  this.addEnergyRangeControlToSetting = function (title, columnClass) {
    if (!isNull(this.plotConfig.energy_range)){

      //Adds energy range selector
      this.onEnergyRangeValuesChanged = function() {
        currentObj.plotConfig.n_bands = Math.max.apply(Math, [1, Math.floor(currentObj.energyRangeSelector.toValue - currentObj.energyRangeSelector.fromValue)]);
        currentObj.settingsPanel.find(".inputNBands").val(currentObj.plotConfig.n_bands);
        currentObj.plotConfig.energy_range = [currentObj.energyRangeSelector.fromValue, currentObj.energyRangeSelector.toValue];
      }

      this.energyRangeSelector = new sliderSelector(this.id + "_EnergyRange",
                                        title + ":",
                                        { table:"EVENTS", column:"E", source: "energy" },
                                        this.plotConfig.default_energy_range[0], this.plotConfig.default_energy_range[1],
                                        this.onEnergyRangeValuesChanged,
                                        null,
                                        function( event, ui ) {
                                          currentObj.energyRangeSelector.setValues( ui.values[ 0 ], ui.values[ 1 ], "slider");
                                          currentObj.onEnergyRangeValuesChanged();
                                        });

      this.energyRangeSelector.setFixedStep(CONFIG.ENERGY_FILTER_STEP);
      this.energyRangeSelector.setEnabled(true);
      this.energyRangeSelector.setValues(this.plotConfig.energy_range[0], this.plotConfig.energy_range[1]);
      this.settingsPanel.find(columnClass).append(this.energyRangeSelector.$html);

    } else {
      logErr ("PlotWithSettings id: " + this.id + " - addEnergyRangeControlToSetting ERROR: plotConfig.energy_range not initialized!");
    }
  }

  this.addNumberOfBandsControlToSettings = function (title, columnClass) {
    if (!isNull(this.plotConfig.n_bands) && this.plotConfig.n_bands > 0){

      //Adds number of point control of rms plot
      this.settingsPanel.find(columnClass).append('</br><p>' + title + ': <input id="n_bands_' + this.id + '" class="inputNBands" type="text" name="n_bands_' + this.id + '" placeholder="' + this.plotConfig.n_bands + '" value="' + this.plotConfig.n_bands + '" /></p>');
      this.settingsPanel.find(columnClass).find(".inputNBands").on('change', function(){
        currentObj.plotConfig.n_bands = getInputIntValueCropped($(this), currentObj.plotConfig.n_bands, 1, CONFIG.MAX_PLOT_POINTS);
      });

    } else {
      logErr ("PlotWithSettings id: " + this.id + " - addNumberOfBandsControlToSettings ERROR: plotConfig.n_bands not initialized!");
    }
  }

  this.addBinSizeSelectorToSettings = function (columnClass) {
    if (this.settingsPanel.find(".binSelectorCheckBox").length > 0) {
      return;
    }

    if (!isNull(this.plotConfig.dt)) {

      //Adds bin size selector to plot
      var tab = getTabForSelector(currentObj.id);
      if (!isNull(tab) && !isNull(tab.toolPanel.binSelector)){

        var enabled = !isNull(this.binSelector) && this.binSelector.enabled;
        var binSize = (enabled) ? this.plotConfig.dt : tab.projectConfig.binSize;

        //Adds the custom binSize switch
        var $binSelectorCheckBox = $('<div class="binSelectorCheckBox ' + ((enabled) ? '' : 'Orange') + '">' +
                                        'Use bin size on filter tab' +
                                        '<div class="switch-wrapper">' +
                                          '<div id="' + this.id + '_binSelectorSwitch" class="switch-btn fa ' + ((enabled) ? 'fa-square-o' : 'fa-check-square-o') + '" aria-hidden="true"></div>' +
                                        '</div>' +
                                      '</div>');
        $binSelectorCheckBox.find(".switch-btn").click( function ( event ) {
          var checkBox = $(this);
          if (checkBox.hasClass("fa-square-o")){
            checkBox.switchClass("fa-square-o", "fa-check-square-o");
            checkBox.parent().parent().addClass("Orange");
            currentObj.binSelector.enabled = false;
            currentObj.binSelector.$html.fadeOut();
          } else {
            checkBox.switchClass("fa-check-square-o", "fa-square-o");
            checkBox.parent().parent().removeClass("Orange");
            currentObj.binSelector.enabled = true;
            currentObj.binSelector.setValues(tab.projectConfig.binSize);
            currentObj.binSelector.$html.fadeIn();
          }
          currentObj.onBinSizeChanged();
        });
        this.settingsPanel.find(columnClass).append($binSelectorCheckBox);

        //Caluculates intial, max, min and step values for slider with time ranges
        var binSelectorConfig = getBinSelectorConfig(tab.projectConfig);

        this.binSelector = new BinSelector(this.id + "_binSelector",
                                          "BIN SIZE (" + tab.projectConfig.timeUnit  + "):",
                                          tab.projectConfig.minBinSize,
                                          tab.projectConfig.maxBinSize,
                                          binSelectorConfig.step,
                                          binSize,
                                          this.onBinSizeChanged,
                                          function( event, ui ) {
                                            currentObj.binSelector.setValues( ui.values[ 0 ], "slider");
                                            currentObj.onBinSizeChanged();
                                          },
                                          CONFIG.MAX_TIME_RESOLUTION_DECIMALS);
        this.binSelector.inputChanged = function ( event ) {
           currentObj.binSelector.setValues( getInputFloatValue(currentObj.binSelector.fromInput, currentObj.plotConfig.dt) );
           currentObj.onBinSizeChanged();
        };

        this.binSelector.enabled = enabled;
        setVisibility(this.binSelector.$html, enabled);

        this.settingsPanel.find(columnClass).append(this.binSelector.$html);
      }
    } else {
      logErr ("PlotWithSettings id: " + this.id + " - addBinSizeSelectorToSettings ERROR: plotConfig.dt is null!");
    }
  }

  this.onBinSizeChanged = function () {
    currentObj.plotConfig.dt = currentObj.binSelector.value;
  }

  this.getBinSize = function () {
    if (isNull(currentObj.binSelector) || !currentObj.binSelector.enabled) {
      var tab = getTabForSelector(this.id);
      if (!isNull(tab)){
        return tab.projectConfig.binSize;
      } else {
        log("ERROR on getBinSize: Plot not attached to tab, Plot: " + this.id);
        return null;
      }
    } else {
      return currentObj.binSelector.value;
    }
  }

  log ("new PlotWithSettings id: " + this.id);

  return this;
}
