"""Add last_accessed_at to Dataset

Revision ID: b7d14fe214c7
Revises: ea9fbebdb61b
Create Date: 2026-07-09 10:39:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7d14fe214c7'
down_revision: Union[str, Sequence[str], None] = 'ea9fbebdb61b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('datasets', sa.Column('last_accessed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True))


def downgrade() -> None:
    op.drop_column('datasets', 'last_accessed_at')
