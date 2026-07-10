"""add model_url to ml experiment session

Revision ID: 7dc398ac6669
Revises: 5e86b0bcd27c
Create Date: 2026-07-10 00:29:47.525712

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7dc398ac6669'
down_revision: Union[str, Sequence[str], None] = 'b7d14fe214c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('ml_experiment_sessions', sa.Column('model_url', sa.String(), nullable=True))

def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('ml_experiment_sessions', 'model_url')
