//Covariance plot

function CovariancePlot(id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable, projectConfig) {

  var currentObj = this;

  var schema = projectConfig.schema;
  if (!isNull(schema["EVENTS"])) {
      table = schema["EVENTS"];
      if (!isNull(table["E"])){

        //Adds Reference Band filter
        var column = table["E"];
        plotConfig.ref_band_interest = [column.min_value, column.max_value];
        plotConfig.n_bands = Math.floor(column.max_value - column.min_value);
        plotConfig.std = -1;
      } else {
        log("CovariancePlot error, plot" + currentObj.id + ", NO ENERGY COLUMN ON SCHEMA");
      }
  } else {
    log("CovariancePlot error, plot" + currentObj.id + ", NO EVENTS TABLE ON SCHEMA");
  }

  Plot.call(this, id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable);

  //Covariance plot methods:

  this.setSettingsTitle = function (title) {
    this.settingsPanel.find(".title").find("h3").first().html(title);
  }

  this.showSettings = function(){
    if (!this.settingsVisible) {
      this.settingsVisible = true;
      var height = parseInt(this.$html.find(".plot").height());
      this.$html.find(".plot").hide();
      this.$html.find(".plotTools").children().hide();
      this.btnBack.show();
      this.settingsPanel.show();
      this.settingsPanel.css({ 'height': height + 'px' });

      var title = 'Settings:';
      if (!isNull(this.plotConfig.styles.title)){
        title = this.plotConfig.styles.title + ' Settings:';
      }

      this.setSettingsTitle(title);
    }
  }

  this.hideSettings = function(){
    if (this.settingsVisible) {
      this.settingsVisible = false;
      this.settingsPanel.hide();
      this.$html.find(".plot").show();
      this.$html.find(".plotTools").children().show();
      this.btnBack.hide();
      this.refreshData();
    }
  }

  this.onReferenceBandValuesChanged = function() {
    try {
      currentObj.plotConfig.n_bands = Math.floor(currentObj.refBandSelector.toValue - currentObj.refBandSelector.fromValue);
      currentObj.settingsPanel.find(".inputNBands").val(currentObj.plotConfig.n_bands);
      currentObj.plotConfig.ref_band_interest = [currentObj.refBandSelector.fromValue, currentObj.refBandSelector.toValue];
    } catch (e) {
      log("onReferenceBandValuesChanged error, plot" + currentObj.id + ", error: " + e);
    }
  }

  this.onNBandsChanged = function(){
    try {
      currentObj.plotConfig.n_bands = parseInt(currentObj.settingsPanel.find(".inputNBands").val());
    } catch (e) {
      log("onNBandsChanged error, plot" + currentObj.id + ", error: " + e);
    }
  }

  this.onStdChanged = function(){
    try {
      currentObj.plotConfig.std = parseFloat(currentObj.settingsPanel.find(".inputStd").val());
    } catch (e) {
      log("onStdChanged error, plot" + currentObj.id + ", error: " + e);
    }
  }

  //CovariancePlot plot attributes:
  this.settingsVisible = false;

  if (!isNull(this.plotConfig.ref_band_interest)){
    this.settingsPanel = $('<div class="settings">' +
                              '<div class="row title"><h3>Settings:</h3></div>' +
                              '<div class="row">' +
                                '<div class="col-xs-6 leftCol">' +
                                '</div>' +
                                '<div class="col-xs-6 rightCol">' +
                                '</div>' +
                              '</div>' +
                            '</div>');
    this.settingsPanel.hide();
    this.$html.prepend(this.settingsPanel);

    //Prepares settingsPanel controls
    this.refBandSelector = new sliderSelector(this.id + "_RefBand",
                                      "Reference Band (keV):",
                                      { table:"EVENTS", column:"E", source: "RefBand" },
                                      "From", "To",
                                      this.plotConfig.ref_band_interest[0], this.plotConfig.ref_band_interest[1],
                                      this.onReferenceBandValuesChanged,
                                      null);
    this.refBandSelector.slider.slider({
           min: this.refBandSelector.fromValue,
           max: this.refBandSelector.toValue,
           values: [this.refBandSelector.fromValue, this.refBandSelector.toValue],
           step: 1,
           slide: function( event, ui ) {
             currentObj.refBandSelector.setValues( ui.values[ 0 ], ui.values[ 1 ], "slider");
             currentObj.onReferenceBandValuesChanged();
           }
       });
    this.refBandSelector.setEnabled(true);
    this.settingsPanel.find(".leftCol").append(this.refBandSelector.$html);

    this.settingsPanel.find(".rightCol").append('<p>Nº Bands: <input id="n_bands_' + this.id + '" class="inputNBands" type="text" name="n_bands_' + this.id + '" placeholder="' + this.plotConfig.n_bands + '" value="' + this.plotConfig.n_bands + '" /></p>');
    this.settingsPanel.find(".rightCol").find(".inputNBands").on('input', this.onNBandsChanged);

    this.settingsPanel.find(".rightCol").append('<p>Standard deviation (<0 Default): <input id="std_' + this.id + '" class="inputStd" type="text" name="std_' + this.id + '" placeholder="' + this.plotConfig.std + '" value="' + this.plotConfig.std + '" /></p>');
    this.settingsPanel.find(".rightCol").find(".inputStd").on('input', this.onStdChanged);

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
    });
  }

  log ("new CovariancePlot id: " + this.id);

  return this;
}
