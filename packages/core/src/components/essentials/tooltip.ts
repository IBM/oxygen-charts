import * as Configuration from "../../configuration";
import { Component } from "../component";
import { Tools } from "../../tools";
import { DOMUtils } from "../../services";
import { ChartModel } from "../../model";

// Carbon position service
import Position, { PLACEMENTS } from "@carbon/utils-position";

// import the settings for the css prefix
import settings from "carbon-components/src/globals/js/settings";

// D3 Imports
import { select, mouse, event } from "d3-selection";
import { TooltipTypes, ScaleTypes, TooltipPosition } from "../../interfaces";

export class Tooltip extends Component {
	type = "tooltip";

	tooltip: any;
	positionService = new Position();

	constructor(model: ChartModel, services: any, configs?: any) {
		super(model, services, configs);

		this.init();
	}

	init() {
		// Grab the tooltip element
		const holder = select(this.services.domUtils.getHolder());
		const chartprefix = Tools.getProperty(this.model.getOptions(), "style", "prefix");
		this.tooltip = DOMUtils.appendOrSelect(holder, `div.${settings.prefix}--${chartprefix}--tooltip`);

		// Apply html content to the tooltip
		const tooltipTextContainer = DOMUtils.appendOrSelect(this.tooltip, "div.content-box");
		this.tooltip.style("max-width", null);

		// listen to show-tooltip Custom Events to render the tooltip
		this.services.events.addEventListener("show-tooltip", e => {
			// check the type of tooltip and that it is enabled
			if ((e.detail.type === TooltipTypes.DATAPOINT && Tools.getProperty(this.model.getOptions(), "tooltip", "datapoint", "enabled"))
				|| (e.detail.type === TooltipTypes.GRIDLINE && Tools.getProperty(this.model.getOptions(), "tooltip", "gridline", "enabled"))) {

				let data = select(event.target).datum() as any;

				// Generate default tooltip
				let defaultTooltip;
				if (e.detail.multidata) {
					// multi tooltip
					data = e.detail.multidata;
					defaultTooltip = this.getMultilineTooltipHTML(data);
				} else {
					defaultTooltip = this.getTooltipHTML(data, TooltipTypes.DATAPOINT);
				}

				// if there is a provided tooltip HTML function call it
				if (Tools.getProperty(this.model.getOptions(), "tooltip", "customHTML")) {
					tooltipTextContainer.html(this.model.getOptions().tooltip.customHTML(data, defaultTooltip));
				} else {
					// Use default tooltip
					tooltipTextContainer.html(defaultTooltip);
				}

				// Position the tooltip
				this.positionTooltip();

			} else if (e.detail.type === TooltipTypes.TITLE) {
				const chart = DOMUtils.appendOrSelect(holder, `svg.${settings.prefix}--${chartprefix}--chart-svg`);
				const chartWidth = DOMUtils.getSVGElementSize(chart).width * Tools.getProperty(this.model.getOptions(), "tooltip", "title", "width");
				this.tooltip.style("max-width", chartWidth);

				// set the content on the tooltip
				tooltipTextContainer.html(this.getTooltipHTML(e.detail.hoveredElement, TooltipTypes.TITLE));

				// get the position based on the title positioning (static)
				const position = this.getTooltipPosition(e.detail.hoveredElement.node());
				this.positionTooltip(position);

			}

			// Fade in
			this.tooltip.classed("hidden", false);
		});

		// listen to hide-tooltip Custom Events to hide the tooltip
		this.services.events.addEventListener("hide-tooltip", () => {
			this.tooltip.classed("hidden", true);
		});
	}

	getTooltipHTML(data: any, type: TooltipTypes) {
		// check if it is getting styles for a tooltip type
		if (type === TooltipTypes.TITLE) {
			const title = this.model.getOptions().title;
			return `<div class="title-tooltip"><text>${title}</text></div>`;
		}
		// this cleans up the data item, pie slices have the data within the data.data but other datapoints are self contained within data
		const dataVal = Tools.getProperty(data, "data") ? data.data : data;

		// format the value if needed
		const valueFormatter = Tools.getProperty(this.model.getOptions(), "tooltip", "valueFormatter");
		const formattedValue = valueFormatter ? valueFormatter(dataVal.value) : dataVal.value.toLocaleString("en");

		// pie charts don't have a dataset label since they only support one dataset
		const label = dataVal.datasetLabel ? dataVal.datasetLabel : dataVal.label;

		return `<div class="datapoint-tooltip">
					<p class="label">${label}</p>
					<p class="value">${formattedValue}</p>
				</div>`;
	}

	getMultilineTooltipHTML(data: any) {
		const points = data;

		// sort them so they are in the same order as the graph
		points.sort((a, b) => b.value - a.value);

		// tells us which value to use
		const scaleType = this.services.axes.getMainXAxis().scaleType;

		return "<ul class='multi-tooltip'>" +
			points.map(datapoint => {
				// check if the datapoint has multiple values associates (multiple axes)
				let datapointValue = datapoint.value;
				if (datapointValue instanceof Object) {
					// scale type determines which value we care about since it should align with the scale data
					datapointValue = scaleType === ScaleTypes.TIME ? datapoint.value.date : datapoint.value.value;
				}
				const valueFormatter = Tools.getProperty(this.model.getOptions(), "tooltip", "valueFormatter");
				const formattedValue = valueFormatter ? valueFormatter(datapointValue) : datapointValue.toLocaleString("en");

				const indicatorColor = this.model.getStrokeColor(datapoint.datasetLabel, datapoint.label);

				return `
				<li>
					<div class="datapoint-tooltip">
						<a style="background-color:${indicatorColor}" class="tooltip-color"></a>
						<p class="label">${datapoint.datasetLabel}</p>
						<p class="value">${formattedValue}</p>
					</div>
				</li>`;
			}).join("") + "</ul>";
	}

	render() {
		this.tooltip.classed("hidden", true);
	}

	// returns static position based on the element
	getTooltipPosition(hoveredElement) {
		const holderPosition = select(this.services.domUtils.getHolder()).node().getBoundingClientRect();
		const elementPosition = hoveredElement.getBoundingClientRect();

		// get the vertical offset
		const { verticalOffset } = this.model.getOptions().tooltip.title;

		const tooltipPos = {
			left: (elementPosition.left - holderPosition.left) + elementPosition.width / 2,
			top: (elementPosition.top - holderPosition.top - verticalOffset)
		};

		return { placement: TooltipPosition.BOTTOM, position: tooltipPos };
	}

	positionTooltip(positionOverride?: any) {
		const holder = this.services.domUtils.getHolder();
		const target = this.tooltip.node();
		const mouseRelativePos = mouse(holder);
		let pos;

		// override position to place tooltip at {placement:.., position:{top:.. , left:..}}
		if (positionOverride) {
			// placement determines whether the tooltip is centered above or below the position provided
			const placement = positionOverride.placement === TooltipPosition.TOP ? PLACEMENTS.TOP : PLACEMENTS.BOTTOM;

			pos = this.positionService.findPositionAt(
				positionOverride.position,
				target,
				placement
			);
		} else {
			// Find out whether tooltip should be shown on the left or right side
			const bestPlacementOption = this.positionService.findBestPlacementAt(
				{
					left: mouseRelativePos[0],
					top: mouseRelativePos[1]
				},
				target,
				[
					PLACEMENTS.RIGHT,
					PLACEMENTS.LEFT,
					PLACEMENTS.TOP,
					PLACEMENTS.BOTTOM
				],
				() => ({
					width: holder.offsetWidth,
					height: holder.offsetHeight
				})
			);

			let { horizontalOffset } = this.model.getOptions().tooltip.datapoint;
			if (bestPlacementOption === PLACEMENTS.LEFT) {
				horizontalOffset *= -1;
			}

			// Get coordinates to where tooltip should be positioned
			pos = this.positionService.findPositionAt(
				{
					left: mouseRelativePos[0] + horizontalOffset,
					top: mouseRelativePos[1]
				},
				target,
				bestPlacementOption
			);
		}

		this.positionService.setElement(target, pos);
	}
}
