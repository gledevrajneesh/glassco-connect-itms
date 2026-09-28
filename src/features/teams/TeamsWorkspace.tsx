import { useState } from "react";
import Icon from "../../components/Icon";
import TeamsAllocationInbox from "./TeamsAllocationInbox";
import TeamsMyFocus from "./TeamsMyFocus";
import TeamsPhaseControl from "./TeamsPhaseControl";
import TeamsDailyUpdate from "./TeamsDailyUpdate";
import TeamsWorkItems from "./TeamsWorkItems";
import TeamsWeeklyReview from "./TeamsWeeklyReview";
import TeamsSprintMom from "./TeamsSprintMom";
import TeamsDirectory from "./TeamsDirectory";
import TeamsPeopleTable from "./TeamsPeopleTable";
import TeamsManagerReview from "./TeamsManagerReview";
import TeamsWorkBoard from "./TeamsWorkBoard";
import TeamsChannelWorkspace from "./TeamsChannelWorkspace";
import TeamsEscalationBoard from "./TeamsEscalationBoard";
import TeamsAttentionInbox from "./TeamsAttentionInbox";
import TeamsGlobalSearch from "./TeamsGlobalSearch";
import "./TeamsWorkspace.css";
import "./TeamsCompactStandard.css";
export default function TeamsWorkspace({
  identityName,
  identityEmail,
  isLeader,
  onExit,
}: {
  identityName: string;
  identityEmail: string;
  isLeader: boolean;
  onExit: () => void;
}) {
  const [screen, setScreen] = useState<
      | "directory"
      | "people"
      | "team"
      | "mywork"
      | "actions"
      | "projects"
      | "checkins"
      | "workitems"
      | "workdetail"
      | "report"
      | "cycles"
      | "collaboration"
      | "signals"
      | "attention"
    >("directory"),
    [notice, setNotice] = useState("");
  const content =
    screen === "directory" ? (
      <TeamsDirectory
        identityEmail={identityEmail}
        isLeader={isLeader}
        onOpenTeam={() => setScreen("team")}
        onOpenMyWork={() => setScreen("mywork")}
        onNotice={setNotice}
      />
    ) : screen === "people" ? (
      <TeamsPeopleTable identityEmail={identityEmail} />
    ) : screen === "team" ? (
      <TeamsManagerReview
        identityEmail={identityEmail}
        isLeader={isLeader}
        onAllocate={() => setScreen("actions")}
        onOpenWork={() => setScreen("workitems")}
        onOpenProjects={() => setScreen("projects")}
        onOpenConversations={() => setScreen("collaboration")}
        onOpenSignals={() => setScreen("signals")}
      />
    ) : screen === "mywork" ? (
      <TeamsMyFocus
        identityName={identityName}
        identityEmail={identityEmail}
        onAllocate={() => setScreen("actions")}
        onNotice={setNotice}
      />
    ) : screen === "projects" ? (
      <TeamsPhaseControl identityEmail={identityEmail} isLeader={isLeader} onNotice={setNotice} />
    ) : screen === "checkins" ? (
      <TeamsDailyUpdate identityEmail={identityEmail} onNotice={setNotice} />
    ) : screen === "workitems" ? (
      <TeamsWorkBoard
        identityEmail={identityEmail}
        isLeader={isLeader}
        onNotice={setNotice}
        onAllocate={() => setScreen("actions")}
        onOpenDetail={() => setScreen("workdetail")}
      />
    ) : screen === "workdetail" ? (
      <TeamsWorkItems
        identityEmail={identityEmail}
        isLeader={isLeader}
        onNotice={setNotice}
        onAllocate={() => setScreen("actions")}
      />
    ) : screen === "collaboration" ? (
      <TeamsChannelWorkspace
        identityEmail={identityEmail}
        onNotice={setNotice}
        onOpenWork={() => setScreen("workitems")}
      />
    ) : screen === "signals" ? (
      <TeamsEscalationBoard identityEmail={identityEmail} isLeader={isLeader} onNotice={setNotice} />
    ) : screen === "attention" ? (
      <TeamsAttentionInbox identityEmail={identityEmail} onOpenWork={() => setScreen("workitems")} onOpenSignals={() => setScreen("signals")} onOpenProjects={() => setScreen("projects")} onOpenConversations={() => setScreen("collaboration")} />
    ) : screen === "report" ? (
      <TeamsWeeklyReview identityEmail={identityEmail} isLeader={isLeader} />
    ) : screen === "cycles" ? (
      <TeamsSprintMom
        identityEmail={identityEmail}
        isLeader={isLeader}
        onNotice={setNotice}
      />
    ) : (
      <TeamsAllocationInbox
        identityEmail={identityEmail}
        isLeader={isLeader}
        onNotice={setNotice}
      />
    );
  return (
    <div className="teams-app">
      <header className="teams-top">
        <div>
          <img src="/brand/glassco-logo-transparent.png" alt="Glassco" />
          CONNECT · <b>TEAMS</b>
        </div>
        <TeamsGlobalSearch
          onOpenPeople={() => setScreen("people")}
          onOpenTeam={() => setScreen("team")}
          onOpenWork={() => setScreen("workitems")}
          onOpenProjects={() => setScreen("projects")}
          onOpenSignals={() => setScreen("signals")}
        />
        <span>GLASSCO WORKSPACE</span>
        <small>{identityEmail}</small>
        <button onClick={onExit}>
          <Icon name="dashboard" size={17} />
          All applications
        </button>
      </header>
      <div className="teams-layout">
        <aside>
          <h2>Glassco Teams</h2>
          <small>COLLABORATE & DELIVER</small>
          <nav className="teams-nav-section" aria-label="My workspace">
            <span className="teams-nav-group">ME</span>
            <button
              className={screen === "mywork" ? "active" : ""}
              onClick={() => setScreen("mywork")}
            >
              <Icon name="history" size={18} />
              My tasks
            </button>
            <button
              className={screen === "attention" ? "active" : ""}
              onClick={() => setScreen("attention")}
            >
              <Icon name="bell" size={18} />
              My attention
            </button>
          </nav>
          <nav className="teams-nav-section" aria-label="Team and collaboration">
            <span className="teams-nav-group">TEAM &amp; COLLABORATION</span>
            <button
              className={screen === "directory" ? "active" : ""}
              onClick={() => setScreen("directory")}
            >
              <Icon name="allocation" size={18} />
              Teams
            </button>
            <button
              className={screen === "people" ? "active" : ""}
              onClick={() => setScreen("people")}
            >
              <Icon name="masters" size={18} />
              People
            </button>
            <button
              className={screen === "team" ? "active" : ""}
              onClick={() => setScreen("team")}
            >
              <Icon name="dashboard" size={18} />
              Team workspace
            </button>
            <button
              className={screen === "collaboration" ? "active" : ""}
              onClick={() => setScreen("collaboration")}
            >
              <Icon name="mail" size={18} />
              Team conversations
            </button>
            <button
              className={screen === "workitems" ? "active" : ""}
              onClick={() => setScreen("workitems")}
            >
              <Icon name="history" size={18} />
              Work items
            </button>
            <button
              className={screen === "signals" ? "active" : ""}
              onClick={() => setScreen("signals")}
            >
              <Icon name="alerts" size={18} />
              Decisions & blockers
            </button>
            <button
              className={screen === "actions" ? "active" : ""}
              onClick={() => setScreen("actions")}
            >
              <Icon name="plus" size={18} />
              Task allocation
            </button>
          </nav>
          <nav className="teams-nav-section" aria-label="Department projects">
            <span className="teams-nav-group">DEPARTMENT PROJECTS</span>
            <button
              className={screen === "projects" ? "active" : ""}
              onClick={() => setScreen("projects")}
            >
              <Icon name="reports" size={18} />
              Projects &amp; phases
            </button>
            <button
              className={screen === "cycles" ? "active" : ""}
              onClick={() => setScreen("cycles")}
            >
              <Icon name="history" size={18} />
              Daily sprints
            </button>
            <button
              className={screen === "checkins" ? "active" : ""}
              onClick={() => setScreen("checkins")}
            >
              <Icon name="history" size={18} />
              Updates &amp; next-day plans
            </button>
            <button
              className={screen === "report" ? "active" : ""}
              onClick={() => setScreen("report")}
            >
              <Icon name="reports" size={18} />
              Delivery report
            </button>
          </nav>
          <footer>
            <b>{identityName}</b>
            <small>Team delivery workspace</small>
          </footer>
        </aside>
        <main>
          {notice && (
            <div className="teams-notice">
              {notice}
              <button onClick={() => setNotice("")}>×</button>
            </div>
          )}
          {content}
        </main>
      </div>
    </div>
  );
}
