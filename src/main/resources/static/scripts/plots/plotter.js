
function get_plotdiv_xy(x_values, y_values, x_error_values, y_error_values, wti_x_ranges, x_label, y_label, title, plotDefaultConfig){
    return {
        data: [
                {
                  type : 'scatter',
                  showlegend : false,
                  hoverinfo : 'none',
                  x : x_values,
                  y : y_values,
                  error_x : !isNull(x_error_values) ? getErrorConfig(x_error_values, plotDefaultConfig) : null,
                  error_y : !isNull(y_error_values) ? getErrorConfig(y_error_values, plotDefaultConfig) : null,
                  line : {
                          color : plotDefaultConfig.DEFAULT_PLOT_COLOR,
                          width : plotDefaultConfig.DEFAULT_LINE_WIDTH.default
                        }
                }
              ],
        layout : {
                   title: !isNull(title) ? title : '',
                   font: plotDefaultConfig.DEFAULT_TITLE_FONT,
                   hovermode: 'closest',
                   xaxis: getLabelConfig(x_label, plotDefaultConfig.DEFAULT_TITLE_FONT),
                   yaxis: getLabelConfig(y_label, plotDefaultConfig.DEFAULT_TITLE_FONT),
                   dragmode:'select',
                   margin: plotDefaultConfig.DEFAULT_MARGINS,
                   shapes: getShapesFromWti (wti_x_ranges, plotDefaultConfig.WTI_FILLCOLOR, plotDefaultConfig.WTI_OPACITY)
                }
      }
}

function get_plotdiv_lightcurve(x_values, y_values, x_error_values, y_error_values, wti_x_ranges, x_label, y_label, title, plotDefaultConfig){
    return {
        data: [
                {
                  type : 'scatter',
                  showlegend : false,
                  hoverinfo : 'none',
                  connectgaps : false,
                  x : x_values,
                  y : y_values,
                  error_x : getErrorConfig(x_error_values, plotDefaultConfig),
                  error_y : getErrorConfig(y_error_values, plotDefaultConfig),
                  line : {
                          shape	:	'hvh',
                          color : plotDefaultConfig.DEFAULT_PLOT_COLOR,
                          width : plotDefaultConfig.DEFAULT_LINE_WIDTH.default
                        }
                }
              ],
        layout : {
                   title: !isNull(title) ? title : '',
                   font: plotDefaultConfig.DEFAULT_TITLE_FONT,
                   hovermode: 'closest',
                   xaxis: getLabelConfig(x_label, plotDefaultConfig.DEFAULT_TITLE_FONT),
                   yaxis: getLabelConfig(y_label, plotDefaultConfig.DEFAULT_TITLE_FONT),
                   dragmode:'select',
                   margin: plotDefaultConfig.DEFAULT_MARGINS,
                   shapes: getShapesFromWti (wti_x_ranges, plotDefaultConfig.WTI_FILLCOLOR, plotDefaultConfig.WTI_OPACITY)
                 }
      }
}

function get_plotdiv_xyz(x_values, y_values, z_values, x_error_values, y_error_values, z_error_values, title, color_label, color_array, plotDefaultConfig){
    return {
        data: [
                {
                  type : 'scatter3d',
                  x : x_values,
                  y : y_values,
                  z : z_values,
                  error_x : getErrorConfig(x_error_values, plotDefaultConfig),
                  error_y : getErrorConfig(y_error_values, plotDefaultConfig),
                  error_z : getErrorConfig(z_error_values, plotDefaultConfig),
                  marker : {
                            symbol : plotDefaultConfig.DEFAULT_MARKER_TYPE,
                            size : plotDefaultConfig.DEFAULT_MARKER_SIZE.default,
                            color : color_array,  // set color to an array/list of desired values
                            colorscale : 'Viridis', // choose a colorscale
                            colorbar : {
                                      title : color_label,
                                      font: plotDefaultConfig.DEFAULT_TITLE_FONT,
                                      thickness : 20,
                                      len : 1
                                    },
                            opacity : plotDefaultConfig.DEFAULT_MARKER_OPACITY
                          }
                }
              ],
        layout : {
                   title: !isNull(title) ? title : '',
                   font: plotDefaultConfig.DEFAULT_TITLE_FONT,
                   margin: plotDefaultConfig.DEFAULT_MARGINS
                }
      }
}

function get_plotdiv_scatter(x_values, y_values, x_label, y_label, title, plotDefaultConfig) {
  return {
      data: [
              {
                type : 'scatter',
                showlegend : false,
                x : x_values,
                y : y_values,
                mode : "markers",
                marker : {
                      symbol : plotDefaultConfig.DEFAULT_MARKER_TYPE,
                      size : plotDefaultConfig.DEFAULT_MARKER_SIZE.default,
                      color : plotDefaultConfig.DEFAULT_PLOT_COLOR,
                      opacity : plotDefaultConfig.DEFAULT_MARKER_OPACITY
                    }
              }
            ],
      layout : getDefaultLayout (title, x_label, y_label, plotDefaultConfig)
    }
}

function get_plotdiv_scatter_with_errors(x_values, y_values, x_error_values, y_error_values, x_label, y_label, title, plotDefaultConfig) {
  var plotdiv = get_plotdiv_scatter(x_values, y_values, x_label, y_label, title, plotDefaultConfig);
  plotdiv.data[0].error_x = getErrorConfig(x_error_values, plotDefaultConfig);
  plotdiv.data[0].error_y = getErrorConfig(y_error_values, plotDefaultConfig);
  return plotdiv;
}

function get_plotdiv_scatter_colored(x_values, y_values, color_array, x_label, y_label, color_label, title, plotDefaultConfig) {
  return {
      data: [
              {
                type : 'scatter',
                x : x_values,
                y : y_values,
                mode : "markers",
                marker : {
                      symbol : plotDefaultConfig.DEFAULT_MARKER_TYPE,
                      size : plotDefaultConfig.DEFAULT_MARKER_SIZE.default,
                      color : color_array,  // set color to an array/list of desired values
                      colorscale : 'Viridis', // choose a colorscale
                      colorbar : {
                                title : color_label,
                                font: plotDefaultConfig.DEFAULT_TITLE_FONT,
                                thickness : 20,
                                len : 1
                              },
                      opacity : plotDefaultConfig.DEFAULT_MARKER_OPACITY
                    }
              }
            ],
      layout : getDefaultLayout (title, x_label, y_label, plotDefaultConfig)
    }
}

function get_plotdiv_dynamical_spectrum(x_values, y_values, z_values, x_label, y_label, z_label, colorscale, title, plotDefaultConfig) {
  return {
      data: [
              {
                type : 'surface',
                x : x_values,
                y : y_values,
                z : z_values,
                colorscale: colorscale
              }
            ],
      layout : {
                 title: !isNull(title) ? title : '',
                 font: plotDefaultConfig.DEFAULT_TITLE_FONT,
                 hovermode: 'closest',
                 xaxis: getLabelConfig(x_label, plotDefaultConfig.DEFAULT_TITLE_FONT),
                 yaxis: getLabelConfig(y_label, plotDefaultConfig.DEFAULT_TITLE_FONT),
                 scene: {
                   xaxis: getLabelConfig(x_label, plotDefaultConfig.DEFAULT_TITLE_FONT),
                   yaxis: getLabelConfig(y_label, plotDefaultConfig.DEFAULT_TITLE_FONT),
                   zaxis: getLabelConfig(z_label, plotDefaultConfig.DEFAULT_TITLE_FONT)
              		},
                 margin: plotDefaultConfig.DEFAULT_MARGINS
              }
      }
}

function get_plotdiv_xyy(x_values, y0_values, y1_values,
                          x_error_values, y0_error_values, y1_error_values,
                          wti_x_ranges, x_label, y0_label, y1_label, title, plotDefaultConfig){
    return {
        data: [
                {
                  type : 'scatter',
                  showlegend : false,
                  hoverinfo : 'none',
                  x : x_values,
                  y : y0_values,
                  error_x : getErrorConfig(x_error_values, plotDefaultConfig),
                  error_y : getErrorConfig(y0_error_values, plotDefaultConfig),
                  name: y0_label
                },
                {
                  type : 'scatter',
                  hoverinfo : 'none',
                  showlegend : false,
                  x : x_values,
                  y : y1_values,
                  error_x : getErrorConfig(x_error_values, plotDefaultConfig),
                  error_y : getErrorConfig(y1_error_values, plotDefaultConfig),
                  name: y1_label
                }
              ],
        layout : {
                   title: !isNull(title) ? title : '',
                   font: plotDefaultConfig.DEFAULT_TITLE_FONT,
                   hovermode: 'closest',
                   xaxis: getLabelConfig(x_label, plotDefaultConfig.DEFAULT_TITLE_FONT),
                   dragmode:'select',
                   margin: plotDefaultConfig.DEFAULT_MARGINS,
                   shapes: getShapesFromWti (wti_x_ranges, plotDefaultConfig.WTI_FILLCOLOR, plotDefaultConfig.WTI_OPACITY)
                }
        }
}

//Return the ploty shapes for higlight the WRONG TIME INTERVALS
function getShapesFromWti (wti_x_ranges, fillcolor, opacity) {
  var wti_shapes = [];

  for (i in wti_x_ranges) {
    var wti_range = wti_x_ranges[i];
    var wti_shape = {
                      type: 'rect',
                      // x-reference is assigned to the x-values
                      xref: 'x',
                      // y-reference is assigned to the plot paper [0,1]
                      yref: 'paper',
                      x0: wti_range[0],
                      y0: 0,
                      x1: wti_range[1],
                      y1: 1,
                      fillcolor: fillcolor,
                      opacity: opacity,
                      line: {
                          width: 0
                      }
                  };
    wti_shapes.push(wti_shape);
  }

  return wti_shapes;
}

function getConfidenceShape (y_range, fillcolor, opacity) {
  return {
          type: 'rect',
          xref: 'paper',
          yref: 'y',
          x0: 0,
          y0: y_range[0],
          x1: 1,
          y1: y_range[1],
          fillcolor: fillcolor,
          opacity: opacity,
          line: {
              width: 0
          }
      };
}

function getDefaultLayout (title, x_label, y_label, plotDefaultConfig) {
  return {
             title: !isNull(title) ? title : '',
             font: plotDefaultConfig.DEFAULT_TITLE_FONT,
             hovermode: 'closest',
             xaxis: getLabelConfig(x_label, plotDefaultConfig.DEFAULT_TITLE_FONT),
             yaxis: getLabelConfig(y_label, plotDefaultConfig.DEFAULT_TITLE_FONT),
             margin: plotDefaultConfig.DEFAULT_MARGINS
          };
}

function getLabelConfig (label, titlefont){
  return { title : label, titlefont : titlefont };
}

function getLine (xdata, ydata, color, width){
  return {
          type : 'scatter',
          showlegend : false,
          hoverinfo : 'none',
          connectgaps : false,
          x : xdata,
          y : ydata,
          line : {
                  color : color,
                  width : width
                }
        };
}

function getCrossLine (xrange, yrange, color, width, style, opacity){
  return { visible: !isNull(color),
           x: xrange,
           y: yrange,
           mode:"lines",
           showlegend: false,
           line: {
                  dash: isNull(style) ? 'solid' : style,
                  width: isNull(width) ? 1 : width,
                  color: isNull(color) ? '#dd4814' : color
                },
           opacity: isNull(opacity) ? 1 : opacity,
           hoverinfo: "none"
         };
}

function getErrorConfig(error_data, plotDefaultConfig) {
  return {
           type : 'data',
           array : error_data,
           visible : true,
           color : plotDefaultConfig.ERROR_BAR_COLOR
        };
}

function getAgnPlotTrace(yaxis, xData, yData, yErrorData, plotDefaultConfig, color) {
  var plotTrace = {
          type : 'scatter',
          mode : "markers",
          showlegend : false,
          hoverinfo : 'x+y',
          x : xData,
          y : yData,
          error_y : !isNull(yErrorData) ? getErrorConfig(yErrorData, plotDefaultConfig) : null,
          marker : {
                symbol : plotDefaultConfig.DEFAULT_MARKER_TYPE,
                size : plotDefaultConfig.DEFAULT_MARKER_SIZE.default,
                color : isNull(color) ? plotDefaultConfig.DEFAULT_PLOT_COLOR : color,
                opacity : plotDefaultConfig.DEFAULT_MARKER_OPACITY
              }
        };

  if (!isNull(yaxis)) {
    plotTrace.yaxis = yaxis;
  }

  return plotTrace;
}

function getAgnPlotTraceWithXErrorData(yaxis, xData, yData, xErrorData, yErrorData, plotDefaultConfig, color) {
  var plotTrace = getAgnPlotTrace(yaxis, xData, yData, yErrorData, plotDefaultConfig, color);
  plotTrace.error_x = getErrorConfig(xErrorData, plotDefaultConfig);
  return plotTrace;
}

function getAnnotation(text, x, y, arrowhead) {
  return {
      x: x,
      y: y,
      xref: 'x',
      yref: 'y',
      text: text,
      showarrow: true,
      arrowhead: 7,
      ax: 0,
      ay: -40
    };
}

function getEmptyPlotStyle (plotlyConfig) {
  var plotStyle = { data: [], layout: {} };
  if (!isNull(plotlyConfig)) {
    for (traceIdx in plotlyConfig.data){
      var traceStyle = getTracePlotStyle(plotlyConfig.data[traceIdx]);
      plotStyle.data.push(traceStyle);
    }
  }
  return plotStyle;
}

function getTracePlotStyle (trace) {
  var traceStyle = {};
  if (!isNull(trace.line)){ traceStyle.line = {}; }
  if (!isNull(trace.marker)){ traceStyle.marker = {}; }
  if (!isNull(trace.error_x)){ traceStyle.error_x = {}; }
  if (!isNull(trace.error_y)){ traceStyle.error_y = {}; }
  if (!isNull(trace.comesFromExtra)){ traceStyle.comesFromExtra = trace.comesFromExtra; }
  return traceStyle;
}
