from datetime import datetime

from sqlalchemy import Column, Float, ForeignKey, Table, func
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base
from .ids import new_id

STATUS = ENUM("BACKLOG", "TODO", "IN_PROGRESS", "DONE", "CANCELED", name="Status", create_type=False)
PRIORITY = ENUM("NONE", "LOW", "MEDIUM", "HIGH", "URGENT", name="Priority", create_type=False)
ROLE = ENUM("OWNER", "MEMBER", "VIEWER", name="Role", create_type=False)

label_task = Table(
    "_LabelToTask",
    Base.metadata,
    Column("A", ForeignKey("Label.id", ondelete="CASCADE"), primary_key=True),  # Label
    Column("B", ForeignKey("Task.id", ondelete="CASCADE"), primary_key=True),   # Task
)


class User(Base):
    __tablename__ = "User"
    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(unique=True)
    password_hash: Mapped[str] = mapped_column("passwordHash")
    created_at: Mapped[datetime] = mapped_column("createdAt", server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column("updatedAt", default=func.now(), onupdate=func.now())


class Workspace(Base):
    __tablename__ = "Workspace"
    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(default="My Workspace")
    created_at: Mapped[datetime] = mapped_column("createdAt", server_default=func.now())


class Membership(Base):
    __tablename__ = "Membership"
    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column("userId", ForeignKey("User.id", ondelete="CASCADE"))
    workspace_id: Mapped[str] = mapped_column("workspaceId", ForeignKey("Workspace.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(ROLE, default="OWNER")
    created_at: Mapped[datetime] = mapped_column("createdAt", server_default=func.now())


class Session(Base):
    __tablename__ = "Session"
    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    token_hash: Mapped[str] = mapped_column("tokenHash", unique=True)
    user_id: Mapped[str] = mapped_column("userId", ForeignKey("User.id", ondelete="CASCADE"))
    expires_at: Mapped[datetime] = mapped_column("expiresAt")
    created_at: Mapped[datetime] = mapped_column("createdAt", server_default=func.now())


class Project(Base):
    __tablename__ = "Project"
    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    name: Mapped[str]
    color: Mapped[str] = mapped_column(default="#8A8A86")
    github_repo_id: Mapped[int | None] = mapped_column("githubRepoId")
    github_repo_full_name: Mapped[str | None] = mapped_column("githubRepoFullName")
    github_installation_id: Mapped[int | None] = mapped_column("githubInstallationId")
    workspace_id: Mapped[str] = mapped_column("workspaceId", ForeignKey("Workspace.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column("createdAt", server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column("updatedAt", default=func.now(), onupdate=func.now())


class Label(Base):
    __tablename__ = "Label"
    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    name: Mapped[str]
    color: Mapped[str] = mapped_column(default="#8A8A86")
    workspace_id: Mapped[str] = mapped_column("workspaceId", ForeignKey("Workspace.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column("createdAt", server_default=func.now())


class Task(Base):
    __tablename__ = "Task"
    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    title: Mapped[str]
    description: Mapped[str | None]
    status: Mapped[str] = mapped_column(STATUS, default="BACKLOG")
    priority: Mapped[str] = mapped_column(PRIORITY, default="NONE")
    due_date: Mapped[datetime | None] = mapped_column("dueDate")
    sort_order: Mapped[float] = mapped_column("sortOrder", Float, default=0)
    project_id: Mapped[str | None] = mapped_column("projectId", ForeignKey("Project.id", ondelete="SET NULL"))
    workspace_id: Mapped[str] = mapped_column("workspaceId", ForeignKey("Workspace.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column("createdAt", server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column("updatedAt", default=func.now(), onupdate=func.now())
    labels: Mapped[list["Label"]] = relationship(secondary=label_task, lazy="selectin")


class Shelf(Base):
    __tablename__ = "Shelf"
    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    project_id: Mapped[str | None] = mapped_column("projectId", ForeignKey("Project.id", ondelete="CASCADE"), unique=True)
    name: Mapped[str] = mapped_column(default="Library")
    description: Mapped[str | None]
    workspace_id: Mapped[str] = mapped_column("workspaceId", ForeignKey("Workspace.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column("createdAt", server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column("updatedAt", default=func.now(), onupdate=func.now())


class Book(Base):
    __tablename__ = "Book"
    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    shelf_id: Mapped[str] = mapped_column("shelfId", ForeignKey("Shelf.id", ondelete="CASCADE"))
    name: Mapped[str]
    description: Mapped[str | None]
    color: Mapped[str] = mapped_column(default="#8A8A86")
    sort_order: Mapped[float] = mapped_column("sortOrder", Float, default=0)
    created_at: Mapped[datetime] = mapped_column("createdAt", server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column("updatedAt", default=func.now(), onupdate=func.now())


class Page(Base):
    __tablename__ = "Page"
    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    book_id: Mapped[str] = mapped_column("bookId", ForeignKey("Book.id", ondelete="CASCADE"))
    title: Mapped[str]
    content: Mapped[str] = mapped_column(default="")
    sort_order: Mapped[float] = mapped_column("sortOrder", Float, default=0)
    created_at: Mapped[datetime] = mapped_column("createdAt", server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column("updatedAt", default=func.now(), onupdate=func.now())
