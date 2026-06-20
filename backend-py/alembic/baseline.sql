--
-- PostgreSQL database dump
--


-- Dumped from database version 14.23 (Ubuntu 14.23-0ubuntu0.22.04.1)
-- Dumped by pg_dump version 14.23 (Ubuntu 14.23-0ubuntu0.22.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: Priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Priority" AS ENUM (
    'NONE',
    'LOW',
    'MEDIUM',
    'HIGH',
    'URGENT'
);


--
-- Name: Role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Role" AS ENUM (
    'OWNER',
    'MEMBER',
    'VIEWER'
);


--
-- Name: Status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Status" AS ENUM (
    'BACKLOG',
    'TODO',
    'IN_PROGRESS',
    'DONE',
    'CANCELED'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Book; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Book" (
    id text NOT NULL,
    "shelfId" text NOT NULL,
    name text NOT NULL,
    description text,
    color text DEFAULT '#8A8A86'::text NOT NULL,
    "sortOrder" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: GithubInstallation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."GithubInstallation" (
    id text NOT NULL,
    "installationId" integer NOT NULL,
    "accountLogin" text NOT NULL,
    "accountType" text NOT NULL,
    "repositorySelection" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "workspaceId" text NOT NULL
);


--
-- Name: GithubUserToken; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."GithubUserToken" (
    id text NOT NULL,
    "githubUserId" integer NOT NULL,
    login text NOT NULL,
    "avatarUrl" text NOT NULL,
    "accessToken" text NOT NULL,
    scope text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "workspaceId" text NOT NULL
);


--
-- Name: Label; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Label" (
    id text NOT NULL,
    name text NOT NULL,
    color text DEFAULT '#8A8A86'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "workspaceId" text NOT NULL
);


--
-- Name: Membership; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Membership" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "workspaceId" text NOT NULL,
    role public."Role" DEFAULT 'OWNER'::public."Role" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Page; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Page" (
    id text NOT NULL,
    "bookId" text NOT NULL,
    title text NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    "sortOrder" double precision DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Project; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Project" (
    id text NOT NULL,
    name text NOT NULL,
    color text DEFAULT '#8A8A86'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "githubInstallationId" integer,
    "githubRepoFullName" text,
    "githubRepoId" integer,
    "workspaceId" text NOT NULL
);


--
-- Name: Session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Session" (
    id text NOT NULL,
    "tokenHash" text NOT NULL,
    "userId" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Shelf; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Shelf" (
    id text NOT NULL,
    "projectId" text,
    name text DEFAULT 'Library'::text NOT NULL,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "workspaceId" text NOT NULL
);


--
-- Name: Task; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Task" (
    id text NOT NULL,
    title text NOT NULL,
    description text,
    status public."Status" DEFAULT 'BACKLOG'::public."Status" NOT NULL,
    priority public."Priority" DEFAULT 'NONE'::public."Priority" NOT NULL,
    "dueDate" timestamp(3) without time zone,
    "sortOrder" double precision DEFAULT 0 NOT NULL,
    "projectId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "workspaceId" text NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Workspace; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Workspace" (
    id text NOT NULL,
    name text DEFAULT 'My Workspace'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: _LabelToTask; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."_LabelToTask" (
    "A" text NOT NULL,
    "B" text NOT NULL
);


--
-- Name: Book Book_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Book"
    ADD CONSTRAINT "Book_pkey" PRIMARY KEY (id);


--
-- Name: GithubInstallation GithubInstallation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GithubInstallation"
    ADD CONSTRAINT "GithubInstallation_pkey" PRIMARY KEY (id);


--
-- Name: GithubUserToken GithubUserToken_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GithubUserToken"
    ADD CONSTRAINT "GithubUserToken_pkey" PRIMARY KEY (id);


--
-- Name: Label Label_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Label"
    ADD CONSTRAINT "Label_pkey" PRIMARY KEY (id);


--
-- Name: Membership Membership_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Membership"
    ADD CONSTRAINT "Membership_pkey" PRIMARY KEY (id);


--
-- Name: Page Page_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Page"
    ADD CONSTRAINT "Page_pkey" PRIMARY KEY (id);


--
-- Name: Project Project_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Project"
    ADD CONSTRAINT "Project_pkey" PRIMARY KEY (id);


--
-- Name: Session Session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_pkey" PRIMARY KEY (id);


--
-- Name: Shelf Shelf_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Shelf"
    ADD CONSTRAINT "Shelf_pkey" PRIMARY KEY (id);


--
-- Name: Task Task_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: Workspace Workspace_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Workspace"
    ADD CONSTRAINT "Workspace_pkey" PRIMARY KEY (id);


--
-- Name: Book_shelfId_sortOrder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Book_shelfId_sortOrder_idx" ON public."Book" USING btree ("shelfId", "sortOrder");


--
-- Name: GithubInstallation_installationId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "GithubInstallation_installationId_key" ON public."GithubInstallation" USING btree ("installationId");


--
-- Name: GithubInstallation_workspaceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GithubInstallation_workspaceId_idx" ON public."GithubInstallation" USING btree ("workspaceId");


--
-- Name: GithubUserToken_workspaceId_githubUserId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "GithubUserToken_workspaceId_githubUserId_key" ON public."GithubUserToken" USING btree ("workspaceId", "githubUserId");


--
-- Name: Label_workspaceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Label_workspaceId_idx" ON public."Label" USING btree ("workspaceId");


--
-- Name: Membership_userId_workspaceId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Membership_userId_workspaceId_key" ON public."Membership" USING btree ("userId", "workspaceId");


--
-- Name: Membership_workspaceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Membership_workspaceId_idx" ON public."Membership" USING btree ("workspaceId");


--
-- Name: Page_bookId_sortOrder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Page_bookId_sortOrder_idx" ON public."Page" USING btree ("bookId", "sortOrder");


--
-- Name: Project_workspaceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Project_workspaceId_idx" ON public."Project" USING btree ("workspaceId");


--
-- Name: Session_tokenHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Session_tokenHash_key" ON public."Session" USING btree ("tokenHash");


--
-- Name: Session_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Session_userId_idx" ON public."Session" USING btree ("userId");


--
-- Name: Shelf_projectId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Shelf_projectId_key" ON public."Shelf" USING btree ("projectId");


--
-- Name: Shelf_workspaceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Shelf_workspaceId_idx" ON public."Shelf" USING btree ("workspaceId");


--
-- Name: Task_priority_sortOrder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Task_priority_sortOrder_idx" ON public."Task" USING btree (priority, "sortOrder");


--
-- Name: Task_projectId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Task_projectId_idx" ON public."Task" USING btree ("projectId");


--
-- Name: Task_status_sortOrder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Task_status_sortOrder_idx" ON public."Task" USING btree (status, "sortOrder");


--
-- Name: Task_workspaceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Task_workspaceId_idx" ON public."Task" USING btree ("workspaceId");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: _LabelToTask_AB_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "_LabelToTask_AB_unique" ON public."_LabelToTask" USING btree ("A", "B");


--
-- Name: _LabelToTask_B_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "_LabelToTask_B_index" ON public."_LabelToTask" USING btree ("B");


--
-- Name: Book Book_shelfId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Book"
    ADD CONSTRAINT "Book_shelfId_fkey" FOREIGN KEY ("shelfId") REFERENCES public."Shelf"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: GithubInstallation GithubInstallation_workspaceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GithubInstallation"
    ADD CONSTRAINT "GithubInstallation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES public."Workspace"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: GithubUserToken GithubUserToken_workspaceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GithubUserToken"
    ADD CONSTRAINT "GithubUserToken_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES public."Workspace"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Label Label_workspaceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Label"
    ADD CONSTRAINT "Label_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES public."Workspace"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Membership Membership_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Membership"
    ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Membership Membership_workspaceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Membership"
    ADD CONSTRAINT "Membership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES public."Workspace"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Page Page_bookId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Page"
    ADD CONSTRAINT "Page_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES public."Book"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Project Project_workspaceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Project"
    ADD CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES public."Workspace"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Session Session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Shelf Shelf_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Shelf"
    ADD CONSTRAINT "Shelf_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Shelf Shelf_workspaceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Shelf"
    ADD CONSTRAINT "Shelf_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES public."Workspace"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Task Task_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Task Task_workspaceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES public."Workspace"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _LabelToTask _LabelToTask_A_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_LabelToTask"
    ADD CONSTRAINT "_LabelToTask_A_fkey" FOREIGN KEY ("A") REFERENCES public."Label"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _LabelToTask _LabelToTask_B_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_LabelToTask"
    ADD CONSTRAINT "_LabelToTask_B_fkey" FOREIGN KEY ("B") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


