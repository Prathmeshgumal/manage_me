from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from .enums import PriorityEnum, StatusEnum, WishlistCategoryEnum, WishlistItemPriorityEnum, WishlistItemStatusEnum

HEX = r"^#([0-9a-fA-F]{6})$"


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Credentials(CamelModel):
    email: str = Field(max_length=320)
    password: str = Field(min_length=8, max_length=200)


class ChangePasswordBody(CamelModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=200)


class CreateTask(CamelModel):
    title: str = Field(min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=20000)
    status: StatusEnum = StatusEnum.BACKLOG
    priority: PriorityEnum = PriorityEnum.NONE
    due_date: datetime | None = None
    project_id: str | None = None
    label_ids: list[str] | None = None


class UpdateTask(CamelModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=20000)
    status: StatusEnum | None = None
    priority: PriorityEnum | None = None
    due_date: datetime | None = None
    project_id: str | None = None
    sort_order: float | None = None
    label_ids: list[str] | None = None


class TaskFilter(CamelModel):
    status: StatusEnum | None = None
    priority: PriorityEnum | None = None
    project_id: str | None = None
    label_id: str | None = None


KEY = r"^[A-Za-z0-9]{2,6}$"


class CreateProject(CamelModel):
    name: str = Field(min_length=1, max_length=200)
    key: str | None = Field(default=None, pattern=KEY)
    color: str = Field(default="#8A8A86", pattern=HEX)
    github_repo_id: int | None = None
    github_repo_full_name: str | None = None
    github_installation_id: int | None = None


class UpdateProject(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    key: str | None = Field(default=None, pattern=KEY)
    color: str | None = Field(default=None, pattern=HEX)
    github_repo_id: int | None = None
    github_repo_full_name: str | None = None
    github_installation_id: int | None = None


class CreateLabel(CamelModel):
    name: str = Field(min_length=1, max_length=100)
    color: str = Field(default="#8A8A86", pattern=HEX)


class UpdateLabel(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    color: str | None = Field(default=None, pattern=HEX)


class UpdateShelf(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)


class CreateBook(CamelModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    color: str = Field(default="#8A8A86", pattern=HEX)


class UpdateBook(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    color: str | None = Field(default=None, pattern=HEX)


class CreatePage(CamelModel):
    title: str = Field(min_length=1, max_length=300)


class UpdatePage(CamelModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    content: str | None = Field(default=None, max_length=500000)


class CreateWishlist(CamelModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    category: WishlistCategoryEnum = WishlistCategoryEnum.OTHER
    icon: str | None = Field(default=None, max_length=50)
    color: str = Field(default="#8A8A86", pattern=HEX)


class UpdateWishlist(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    category: WishlistCategoryEnum | None = None
    icon: str | None = Field(default=None, max_length=50)
    color: str | None = Field(default=None, pattern=HEX)


class CreateWishlistItem(CamelModel):
    title: str = Field(min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=20000)
    price: float | None = Field(default=None, ge=0)
    currency: str = Field(default="INR", max_length=10)
    status: WishlistItemStatusEnum = WishlistItemStatusEnum.WISHLIST
    priority: WishlistItemPriorityEnum = WishlistItemPriorityEnum.NICE_TO_HAVE
    target_date: datetime | None = None


class UpdateWishlistItem(CamelModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=20000)
    price: float | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, max_length=10)
    status: WishlistItemStatusEnum | None = None
    priority: WishlistItemPriorityEnum | None = None
    target_date: datetime | None = None
    sort_order: float | None = None
