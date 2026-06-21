from enum import Enum


class StatusEnum(str, Enum):
    BACKLOG = "BACKLOG"
    TODO = "TODO"
    IN_PROGRESS = "IN_PROGRESS"
    DONE = "DONE"
    CANCELED = "CANCELED"


class PriorityEnum(str, Enum):
    NONE = "NONE"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"


class WishlistCategoryEnum(str, Enum):
    ITEMS = "Items"
    PLACES = "Places"
    GOALS = "Goals"
    OTHER = "Other"


class WishlistItemStatusEnum(str, Enum):
    WISHLIST = "WISHLIST"
    SAVING = "SAVING"
    PURCHASED = "PURCHASED"
    ARCHIVED = "ARCHIVED"


class WishlistItemPriorityEnum(str, Enum):
    MUST_HAVE = "MUST_HAVE"
    NICE_TO_HAVE = "NICE_TO_HAVE"
    DREAM = "DREAM"
