/* eslint-disable @typescript-eslint/explicit-function-return-type */
// @ts-nocheck

import { createPlanView, PlanView } from "./PlanView";
import { parser } from "pddl-workspace";

// function onPlanSelected(planIndex: number): void {
    // todo: postMessage({ "command": "selectPlan", "planIndex": planIndex});
//     console.log(`Plan selected: ${planIndex}`);
// }

function onActionSelected(actionName: string): void {
    // todo: postMessage({ "command": "selectPlan", "planIndex": planIndex});
    console.log(`Action selected: ${actionName}`);
}

function onHelpfulActionSelected(actionName: string): void {
    // todo: navigateToChildOfSelectedState(actionName)
    console.log(`Helpful action selected: ${actionName}`);
}

let planView: PlanView | undefined;

const EPSILON = 1e-3;

function initialize() {
    planView = createPlanView("plan", onActionSelected, onHelpfulActionSelected, { disableSwimlanes: false, displayWidth: 300, epsilon: EPSILON });
}

async function addPlan() {

    const domainText = document.getElementById("domainText")?.value ?? "";
    const problemText = document.getElementById("problemText")?.value ?? "";
    const planText = document.getElementById("planText")?.value ?? "";

    const domain = parser.PddlDomainParser.parseText(domainText);
    const problem = await parser.PddlProblemParser.parseText(problemText);
    
    const planInfo = parser.PddlPlanParser.parseText(planText, EPSILON);

    planView?.showPlan(planInfo.getPlan(domain, problem), 0);
}

document.getElementById("addPlan").onclick = addPlan
document.body.onload = () => initialize();
