
var DEFAULT_TITLE_FONT = {
            family : 'Courier New, monospace',
            size : 18,
            color : '#7f7f7f'
          };

var DEFAULT_MARGINS = { b : 42, r : 12, l: 64, t: 24 }

function get_plotdiv_xy(x_values, y_values, x_error_values, y_error_values, x_label, y_label, title){

    return {
        data: [
                {
                  type : 'scatter',
                  hoverinfo : 'none',
                  x : x_values,
                  y : y_values,
                  error_x : {
                             type : 'data',
                             array : x_error_values,
                             visible : true
                          },
                  error_y : {
                             type : 'data',
                             array : y_error_values,
                             visible : true
                          }
                }
              ],
        layout : {
                   title : !isNull(title) ? title : '',
                   hovermode: 'closest',
                   xaxis : {
                             title : x_label,
                             titlefont : DEFAULT_TITLE_FONT
                           },
                   yaxis: {
                             title : y_label,
                             titlefont : DEFAULT_TITLE_FONT
                         },
                  dragmode:'select',
                  margin: DEFAULT_MARGINS
                }
        }
}

function get_plotdiv_xyz(x_values, y_values, z_values, x_error_values, y_error_values, z_error_values, title, color_label, color_array){

    return {
        data: [
                {
                  type : 'scatter3d',
                  x : x_values,
                  y : y_values,
                  z : z_values,
                  error_x : {
                             type : 'data',
                             array : x_error_values,
                             visible : true
                          },
                  error_y : {
                             type : 'data',
                             array : y_error_values,
                             visible : true
                          },
                  error_z : {
                             type : 'data',
                             array : z_error_values,
                             visible : true
                          },
                  marker : {
                            size : 5,
                            color : color_array,  // set color to an array/list of desired values
                            colorscale : 'Viridis', // choose a colorscale
                            colorbar : {
                                      title : color_label,
                                      thickness : 20,
                                      len : 1
                                    },
                            opacity : 0.8
                          }
                }
              ],
        layout : {
                   title : !isNull(title) ? title : '',
                   margin: DEFAULT_MARGINS
                }
        }
}

function get_plotdiv_scatter(x_values, y_values, x_label, y_label, title) {

  return {
      data: [
              {
                type : 'scatter',
                x : x_values,
                y : y_values,
                mode : "markers",
                marker : {
                      size : 6,
                      opacity : 0.8
                    }
              }
            ],
      layout : {
                 title : !isNull(title) ? title : '',
                 hovermode: 'closest',
                 xaxis : {
                           title : x_label,
                           titlefont : DEFAULT_TITLE_FONT
                         },
                 yaxis: {
                           title : y_label,
                           titlefont : DEFAULT_TITLE_FONT
                       },
                 margin: DEFAULT_MARGINS
              }
      }
}

function get_plotdiv_scatter_colored(x_values, y_values, color_array, x_label, y_label, color_label, title) {

  return {
      data: [
              {
                type : 'scatter',
                x : x_values,
                y : y_values,
                mode : "markers",
                marker : {
                      size : 6,
                      color : color_array,  // set color to an array/list of desired values
                      colorscale : 'Viridis', // choose a colorscale
                      colorbar : {
                                title : color_label,
                                thickness : 20,
                                len : 1
                              },
                      opacity : 0.8
                    }
              }
            ],
      layout : {
                 title : !isNull(title) ? title : '',
                 hovermode: 'closest',
                 xaxis : {
                           title : x_label,
                           titlefont : DEFAULT_TITLE_FONT
                         },
                 yaxis: {
                           title : y_label,
                           titlefont : DEFAULT_TITLE_FONT
                       },
                 margin: DEFAULT_MARGINS
              }
      }

}

function get_plotdiv_xyy(x_values, y0_values, y1_values,
                          x_error_values, y0_error_values, y1_error_values,
                          x_label, y0_label, y1_label, title){

    return {
        data: [
                {
                  type : 'scatter',
                  hoverinfo : 'none',
                  x : x_values,
                  y : y0_values,
                  error_x : {
                             type : 'data',
                             array : x_error_values,
                             visible : true
                          },
                  error_y : {
                             type : 'data',
                             array : y0_error_values,
                             visible : true
                          },
                  name: y0_label
                },
                {
                  type : 'scatter',
                  hoverinfo : 'none',
                  x : x_values,
                  y : y1_values,
                  error_x : {
                             type : 'data',
                             array : x_error_values,
                             visible : true
                          },
                  error_y : {
                             type : 'data',
                             array : y1_error_values,
                             visible : true
                          },
                  name: y1_label
                }
              ],
        layout : {
                   title : !isNull(title) ? title : '',
                   hovermode: 'closest',
                   xaxis : {
                             title : x_label,
                             titlefont : DEFAULT_TITLE_FONT
                           },
                  dragmode:'select',
                  margin: DEFAULT_MARGINS
                }
        }
}
