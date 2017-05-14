//Lightcurve plot

function LcPlot(id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable) {

  var currentObj = this;

  Plot.call(this, id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable);

  //LC plot attributes:
  this.settingsVisible = false;
  this.baselineEnabled = false;

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


  //LC plot methods:

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

      var tab = getTabForSelector(this.id);

      if (this.settingsPanel.find(".baseline").length == 0) {

        var lamValue = 1000;
        var pValue = 0.01;
        var niterValue = 10;

        var $baseline = $('<div class="baseline">' +
                            '<h3>' +
                              'Draw baseline:' +
                              '<div class="switch-wrapper">' +
                                '<div id="switch_' + this.id + '" class="switch-btn fa fa-plus-square" aria-hidden="true"></div>' +
                              '</div>' +
                            '</h3>' +
                            '<div class="baselineContainer">' +
                              '<p>Smoothness: <input id="lam_' + this.id + '" class="inputLam" type="text" name="lam_' + this.id + '" placeholder="' + lamValue + '" value="' + lamValue + '" /></p>' +
                              '<p>Asymmetry: <input id="p_' + this.id + '" class="inputP" type="text" name="p_' + this.id + '" placeholder="' + pValue + '" value="' + pValue + '" /></p>' +
                              '<p>Nº iterations: <input id="niter_' + this.id + '" class="inputNiter" type="text" name="niter_' + this.id + '" placeholder="' + niterValue + '" value="' + niterValue + '" /></p>' +
                            '</div>' +
                          '</div>');

        //Prepares switchBox
        var switchBox = $baseline.find("#switch_" + this.id);
        switchBox.click( function ( event ) {
          currentObj.baselineEnabled = !currentObj.baselineEnabled;
          currentObj.onBaselineValuesChanged();
          if (currentObj.baselineEnabled) {
            $(this).switchClass("fa-plus-square", "fa-minus-square");
            currentObj.settingsPanel.find(".baselineContainer").fadeIn();
          } else {
            $(this).switchClass("fa-minus-square", "fa-plus-square");
            currentObj.settingsPanel.find(".baselineContainer").fadeOut();
          }
        });

        //Prepares input events
        $baseline.find(".baselineContainer").hide();
        $baseline.find("input").on('change', this.onBaselineValuesChanged);

        this.settingsPanel.find(".leftCol").append($baseline);
      }
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

  this.onBaselineValuesChanged = function(){
    if (currentObj.baselineEnabled) {
      currentObj.plotConfig.baseline_opts.lam = getInputFloatValue(currentObj.settingsPanel.find(".inputLam"), currentObj.plotConfig.baseline_opts.lam);
      currentObj.plotConfig.baseline_opts.p = getInputFloatValue(currentObj.settingsPanel.find(".inputP"), currentObj.plotConfig.baseline_opts.p);
      currentObj.plotConfig.baseline_opts.niter = getInputIntValue(currentObj.settingsPanel.find(".inputNiter"), currentObj.plotConfig.baseline_opts.niter);
    } else {
      currentObj.disableBaseline();
    }
  }

  this.updateBaselineInputs = function (bsOpts) {
    if (bsOpts.niter > 0) {
      currentObj.settingsPanel.find(".inputLam").val(bsOpts.lam);
      currentObj.settingsPanel.find(".inputP").val(bsOpts.p);
      currentObj.settingsPanel.find(".inputNiter").val(bsOpts.niter);
      currentObj.settingsPanel.find(".baselineContainer").show();
    } else {
      currentObj.settingsPanel.find(".baselineContainer").hide();
    }
  }

  this.disableBaseline = function () {
    currentObj.plotConfig.baseline_opts = { niter: 0 };
  }

  this.getPlotlyConfig = function (data) {
    var coords = currentObj.getSwitchedCoords( { x: 0, y: 1} );
    var plotlyConfig = get_plotdiv_lightcurve(data[0].values, data[1].values,
                                        [], data[2].values,
                                        (data.length > 4) ? currentObj.getWtiRangesFromGtis(data[3].values, data[4].values, data[0].values) : [],
                                        currentObj.plotConfig.styles.labels[coords.x],
                                        currentObj.plotConfig.styles.labels[coords.y],
                                        currentObj.plotConfig.styles.title);

    if (data.length > 5) {
      if (data[5].values.length > 0) {
        //Lightcurve has baseline values
        plotlyConfig.data.push({
                                type : 'scatter',
                                showlegend : false,
                                hoverinfo : 'none',
                                connectgaps : false,
                                x : data[0].values,
                                y : data[5].values,
                                line : {
                                        color : '#DD3333'
                                      }
                              });
      }
    } else {
      currentObj.btnSettings.hide();
    }

    plotlyConfig = currentObj.prepareAxis(plotlyConfig);

    return plotlyConfig;
  }

  this.getPlotDefaultTracesCount = function (){
      return (currentObj.data.length > 5 && currentObj.data[5].values.length > 0) ? 2 : 1;
  }

  //LC BaseLine parameters:
  this.disableBaseline();

  log ("new LcPlot id: " + this.id);

  return this;
}
