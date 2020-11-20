/* --------------------------------------------------------------------------------------------
 * Copyright (c) Jan Dolejsi 2020. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

 /* eslint-disable @typescript-eslint/no-use-before-define */

import { DomainInfo, Plan, PlanStep, PlanStepCommitment, HappeningType, HelpfulAction } from "pddl-workspace";
import { capitalize } from "./planCapitalization";
import { PlanReportSettings } from "./PlanReportSettings";

export interface PlanViewOptions {
    epsilon: number;
    displayWidth: number;
    disableSwimlanes?: boolean;
    selfContained?: boolean;
}

const DIGITS = 4;

export class PlanView {

    host: HTMLElement;
    planStepHeight = 20;

    constructor(hostElementId: string,
        private readonly onActionSelected: (actionName: string) => void,
        private readonly onHelpfulActionSelected: (actionName: string) => void, 
        private readonly options: PlanViewOptions) {
        const host = document.getElementById(hostElementId);
        if (host === null) {
            throw new Error(`Element with id#${hostElementId} not found in the document.`);
        }
        this.host = host;
    }

    showPlan(plan: Plan, planIndex: number, settings?: PlanReportSettings): void {
        // todo: add custom plan visualization here

        plan = capitalize(plan);

        const stepsToDisplay = plan.steps
            .filter(step => this.shouldDisplay(step, settings));
        
        const ganttDiv = this.host.querySelector<HTMLDivElement>('.gantt') ?? this.createSubElement('gantt');
        this.showGantt(ganttDiv, plan, stepsToDisplay, planIndex)

        console.dir(plan);
        console.dir(plan.domain);
        console.dir(plan.problem);
    }

    private createSubElement(className: string): HTMLDivElement {
        const child = document.createElement('div');
        child.className = className;
        return this.host.appendChild(child);
    }

    showGantt(ganttDiv: HTMLDivElement, plan: Plan, stepsToDisplay: PlanStep[], planIndex: number): void {
        // split this to two batches and insert helpful actions in between
        const planHeadSteps = stepsToDisplay
            .filter(step => this.isPlanHeadStep(step, plan.now));
        const relaxedPlanSteps = stepsToDisplay
            .filter(step => !this.isPlanHeadStep(step, plan.now));

        const oneIfHelpfulActionsPresent = (plan.hasHelpfulActions() ? 1 : 0);
        const relaxedPlanStepIndexOffset = planHeadSteps.length + oneIfHelpfulActionsPresent;

        const ganttChartHeight = (stepsToDisplay.length + oneIfHelpfulActionsPresent) * this.planStepHeight;

        ganttDiv.setAttribute("plan", planIndex.toString());
        ganttDiv.style.height = px(ganttChartHeight);

        planHeadSteps
            .map((step, stepIndex) => this.renderGanttStep(ganttDiv, step, stepIndex, plan));

        this.renderHelpfulActions(ganttDiv, plan, planHeadSteps.length);

        relaxedPlanSteps
                .map((step, stepIndex) => this.renderGanttStep(ganttDiv, step, stepIndex + relaxedPlanStepIndexOffset, plan));
    }

    renderGanttStep(ganttDiv: HTMLDivElement, step: PlanStep, index: number, plan: Plan): void {

        const fromTop = index * this.planStepHeight;
        const fromLeft = this.computeLeftOffset(step, plan);
        const planHeadDuration = this.computePlanHeadDuration(step, plan);
        const width = this.computeWidth(planHeadDuration, plan);
        const widthRelaxed = this.computeRelaxedWidth(planHeadDuration, step, plan);

        const actionColor = plan.domain ? this.getActionColor(step, plan.domain) : 'gray';
        const actionIterations = step.getIterations() > 1 ? `${step.getIterations()}x` : '';

        const planStep = document.createElement('div');
        planStep.id = "plan${planIndex}step${index}";
        planStep.className = "planstep";
        planStep.style.left = px(fromLeft);
        planStep.style.top = px(fromTop);

        const planStepBar = document.createElement('div');
        planStepBar.className = "planstep-bar";
        planStepBar.title = this.toActionTooltipPlain(step);
        planStepBar.style.width = px(width);
        planStepBar.style.backgroundColor = actionColor;

        const planStepBarRelaxed = document.createElement('div');
        planStepBarRelaxed.className = "planstep-bar-relaxed whitecarbon";
        planStepBarRelaxed.style.width = px(widthRelaxed);

        const actionLink = this.toActionLink(step.getActionName(), plan);

        const text = document.createTextNode(` ${step.getObjects().join(' ')} ${actionIterations}`);

        planStep.append(planStepBar, planStepBarRelaxed, actionLink, text);
        ganttDiv.appendChild(planStep);
    }

    renderHelpfulActions(ganttDiv: HTMLDivElement, plan: Plan, planHeadLength: number): void {
        if (plan.hasHelpfulActions()) {
            const fromTop = planHeadLength * this.planStepHeight;
            const fromLeft = this.toViewCoordinates(plan.now, plan);

            const helpfulActions = document.createElement("div");
            helpfulActions.className = "planstep";
            helpfulActions.style.top = px(fromTop);
            helpfulActions.style.left = px(fromLeft);
            helpfulActions.style.marginTop = px(3);


            const arrow = document.createTextNode(`▶ `);
            helpfulActions.appendChild(arrow);

            plan.helpfulActions
                ?.forEach((helpfulAction, index) =>
                    this.renderHelpfulAction(ganttDiv, index, helpfulAction));

            ganttDiv.appendChild(helpfulActions);
        }
    }

    renderHelpfulAction(helpfulActions: HTMLDivElement, index: number, helpfulAction: HelpfulAction): void {
        const suffix = PlanView.getActionSuffix(helpfulAction);
        const beautifiedName = `${helpfulAction.actionName}<sub>${suffix}</sub>`;

        helpfulActions.appendChild(document.createTextNode(`${index + 1}. `));

        const a = document.createElement("a");
        a.href = "#";
        a.onclick = (): void => this.onHelpfulActionSelected(helpfulAction.actionName);
        a.innerHTML = beautifiedName;
        
        helpfulActions.appendChild(a);
    }

    static getActionSuffix(helpfulAction: HelpfulAction): string {
        switch (helpfulAction.kind) {
            case HappeningType.START:
                return '├';
            case HappeningType.END:
                return '┤';
        }
        return '';
    }

    computeLeftOffset(step: PlanStep, plan: Plan): number {
        return this.toViewCoordinates(step.getStartTime(), plan);
    }
    
    /** Converts the _time_ argument to view coordinates */
    toViewCoordinates(time: number | undefined, plan: Plan): number {
        return (time ?? 0) / plan.makespan * this.options.displayWidth;
    }

    toActionLink(actionName: string, plan: Plan): Node {
        if (this.options.selfContained || !plan.domain) {
            return document.createTextNode(actionName);
        }
        else {
            const revealActionUri = encodeURI('command:pddl.revealAction?' + JSON.stringify([plan.domain.fileUri, actionName]));
            const a = document.createElement("a");
            a.href = revealActionUri;
            a.title = "Reveal '${actionName}' action in the domain file";
            a.innerText = actionName;
            return a;
        }
    }
    
    toActionTooltipPlain(step: PlanStep): string {
        const durationRow = step.isDurative && step.getDuration() !== undefined ?
            `Duration: ${step.getDuration()?.toFixed(DIGITS)}, End: ${step.getEndTime().toFixed(DIGITS)}` :
            '';

        const startTime = step.getStartTime() !== undefined ?
            `, Start: ${step.getStartTime().toFixed(DIGITS)}` :
            '';

        return `${step.getActionName()} ${step.getObjects().join(' ')}${startTime} ${durationRow}`;
    }

    computePlanHeadDuration(step: PlanStep, plan: Plan): number {
        if (plan.now === undefined) { return step.getDuration() ?? this.options.epsilon; }
        else if (step.getEndTime() < plan.now) {
            if (step.commitment === PlanStepCommitment.Committed) { return step.getDuration() ?? this.options.epsilon; }
            else { return 0; } // the end was not committed yet
        }
        else if (step.getStartTime() >= plan.now) { return 0; }
        else {
            switch (step.commitment) {
                case PlanStepCommitment.Committed:
                    return step.getDuration() ?? this.options.epsilon;
                case PlanStepCommitment.EndsInRelaxedPlan:
                    return 0;
                case PlanStepCommitment.StartsInRelaxedPlan:
                    return plan.now - step.getStartTime();
                default:
                    return 0; // should not happen
            }
        }
    }

    computeWidth(planHeadDuration: number, plan: Plan): number {
        // remove the part of the planStep duration that belongs to the relaxed plan
        return Math.max(1, this.toViewCoordinates(planHeadDuration, plan));
    }

    computeRelaxedWidth(planHeadDuration: number, step: PlanStep, plan: Plan): number {
        // remove the part of the planStep duration that belongs to the planhead part
        const relaxedDuration = (step.getDuration() ?? this.options.epsilon) - planHeadDuration;
        return this.toViewCoordinates(relaxedDuration, plan);
    }

    isPlanHeadStep(step: PlanStep, timeNow: number | undefined): boolean {
        return timeNow === undefined ||
            step.commitment === PlanStepCommitment.Committed ||
            step.commitment === PlanStepCommitment.EndsInRelaxedPlan;
    }
    
    shouldDisplay(planStep: PlanStep, settings?: PlanReportSettings): boolean {
        return settings?.shouldDisplay(planStep) ?? true;
    }

    getActionColor(step: PlanStep, domain?: DomainInfo): string {
        const actionIndex = domain?.getActions()
            .findIndex(action => action.getNameOrEmpty().toLowerCase() === step.getActionName().toLowerCase());
        if (actionIndex === undefined || actionIndex < 0) {
            return 'gray';
        }
        else {
            return this.colors[actionIndex * 7 % this.colors.length];
        }
    }

    colors = ['#ff0000', '#ff4000', '#ff8000', '#ffbf00', '#ffff00', '#bfff00', '#80ff00', '#40ff00', '#00ff00', '#00ff40', '#00ff80', '#00ffbf', '#00ffff', '#00bfff', '#0080ff', '#0040ff', '#0000ff', '#4000ff', '#8000ff', '#bf00ff', '#ff00ff', '#ff00bf', '#ff0080', '#ff0040'];

}

function px(valueInPx: number): string {
    return `${valueInPx}px`;
}

export function createPlanView(hostElementId: string, onActionSelected: (actionName: string) => void,
    onHelpfulActionSelected: (actionName: string) => void, 
    options: PlanViewOptions): PlanView {
    return new PlanView(hostElementId, onActionSelected, onHelpfulActionSelected, options);
}

