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

  this.btnSettings = $('<button class="btn btn-default btnSettings' + this.id + '"><i class="fa fa-cog" aria-hidden="true"></i></button>');
  this.$html.find(".plotTools").append(this.btnSettings);
  this.btnSettings.click(function(event){
    currentObj.showSettings();
  });

  this.btnBack = $('<button class="btn btn-default btnBack' + this.id + '"><i class="fa fa-arrow-left" aria-hidden="true"></i></button>');
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
      var height = parseInt(this.$html.find(".plot").height());
      this.$html.find(".plot").hide();
      this.$html.find(".plotTools").children().hide();

      var title = 'Settings:';
      if (!isNull(this.plotConfig.styles.title)){
        title = this.plotConfig.styles.title + ' Settings:';
      }
      this.setSettingsTitle(title);

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

      // Creates the X axis type radio buttons
      this.xAxisRadios = $('<div class="pdsXAxisType AxisType">' +
                            '<h3>' + currentObj.plotConfig.styles.labels[0] + ' axis type:</h3>' +
                            '<fieldset>' +
                              '<label for="' + this.id + '_Xlinear">Linear</label>' +
                              '<input type="radio" name="' + this.id + 'XAxisType" id="' + this.id + '_Xlinear" value="linear" ' + getCheckedState(this.plotConfig.xAxisType == "linear") + '>' +
                              '<label for="' + this.id + '_Xlog">Logarithmic</label>' +
                              '<input type="radio" name="' + this.id + 'XAxisType" id="' + this.id + '_Xlog" value="log" ' + getCheckedState(this.plotConfig.xAxisType == "log") + '>' +
                            '</fieldset>' +
                          '</div>');

      this.settingsPanel.find(columnClass).append(this.xAxisRadios);
      var $xAxisRadios = this.xAxisRadios.find("input[type=radio][name=" + this.id + "XAxisType]")
      $xAxisRadios.checkboxradio();
      this.xAxisRadios.find("fieldset").controlgroup();
      $xAxisRadios.change(function() {
        currentObj.plotConfig.xAxisType = this.value;
      });

      // Creates the Y axis type radio buttons
      this.yAxisRadios = $('<div class="pdsYAxisType AxisType">' +
                            '<h3>' + currentObj.plotConfig.styles.labels[1] + ' axis type:</h3>' +
                            '<fieldset>' +
                              '<label for="' + this.id + '_Ylinear">Linear</label>' +
                              '<input type="radio" name="' + this.id + 'YAxisType" id="' + this.id + '_Ylinear" value="linear" ' + getCheckedState(this.plotConfig.yAxisType == "linear") + '>' +
                              '<label for="' + this.id + '_Ylog">Logarithmic</label>' +
                              '<input type="radio" name="' + this.id + 'YAxisType" id="' + this.id + '_Ylog" value="log" ' + getCheckedState(this.plotConfig.yAxisType == "log") + '>' +
                            '</fieldset>' +
                          '</div>');

      this.settingsPanel.find(columnClass).append(this.yAxisRadios);
      var $yAxisRadios = this.yAxisRadios.find("input[type=radio][name=" + this.id + "YAxisType]")
      $yAxisRadios.checkboxradio();
      this.yAxisRadios.find("fieldset").controlgroup();
      $yAxisRadios.change(function() {
        currentObj.plotConfig.yAxisType = this.value;
      });

      if (!isNull(this.plotConfig.zAxisType)) {
        // Creates the X axis type radio buttons
        this.zAxisRadios = $('<div class="pdsZAxisType AxisType">' +
                              '<h3>' + currentObj.plotConfig.styles.labels[2] + ' axis type:</h3>' +
                              '<fieldset>' +
                                '<label for="' + this.id + '_Zlinear">Linear</label>' +
                                '<input type="radio" name="' + this.id + 'ZAxisType" id="' + this.id + '_Zlinear" value="linear" ' + getCheckedState(this.plotConfig.zAxisType == "linear") + '>' +
                                '<label for="' + this.id + '_Zlog">Logarithmic</label>' +
                                '<input type="radio" name="' + this.id + 'ZAxisType" id="' + this.id + '_Zlog" value="log" ' + getCheckedState(this.plotConfig.zAxisType == "log") + '>' +
                              '</fieldset>' +
                            '</div>');

        this.settingsPanel.find(columnClass).append(this.zAxisRadios);
        var $zAxisRadios = this.zAxisRadios.find("input[type=radio][name=" + this.id + "ZAxisType]")
        $zAxisRadios.checkboxradio();
        this.zAxisRadios.find("fieldset").controlgroup();
        $zAxisRadios.change(function() {
          currentObj.plotConfig.zAxisType = this.value;
        });
      }

    } else {
      log ("PlotWithSettings id: " + this.id + " - addAxesTypeControlsToSettings ERROR: plotConfig.xAxisType or plotConfig.yAxisType not initialized!");
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
                                        "From", "To",
                                        this.plotConfig.default_energy_range[0], this.plotConfig.default_energy_range[1],
                                        this.onEnergyRangeValuesChanged,
                                        null);
      this.energyRangeSelector.slider.slider({
             min: this.energyRangeSelector.fromValue,
             max: this.energyRangeSelector.toValue,
             values: [this.energyRangeSelector.fromValue, this.energyRangeSelector.toValue],
             step: CONFIG.ENERGY_FILTER_STEP,
             slide: function( event, ui ) {
               currentObj.energyRangeSelector.setValues( ui.values[ 0 ], ui.values[ 1 ], "slider");
               currentObj.onEnergyRangeValuesChanged();
             }
         });

      this.energyRangeSelector.setFixedStep(CONFIG.ENERGY_FILTER_STEP);
      this.energyRangeSelector.setEnabled(true);
      this.energyRangeSelector.setValues(this.plotConfig.energy_range[0], this.plotConfig.energy_range[1]);
      this.settingsPanel.find(columnClass).append(this.energyRangeSelector.$html);

    } else {
      log ("PlotWithSettings id: " + this.id + " - addEnergyRangeControlToSetting ERROR: plotConfig.energy_range not initialized!");
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
      log ("PlotWithSettings id: " + this.id + " - addNumberOfBandsControlToSettings ERROR: plotConfig.n_bands not initialized!");
    }
  }

  log ("new PlotWithSettings id: " + this.id);

  return this;
}
