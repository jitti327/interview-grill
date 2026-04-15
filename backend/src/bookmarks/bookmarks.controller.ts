import { Controller, Post, Get, Delete, Param, Body, Req, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { BookmarksService } from './bookmarks.service';
import { OptionalAuthGuard } from '../auth/jwt.guard';
import { Request } from 'express';

class CreateBookmarkDto {
  @IsString() session_id: string;
  @IsString() round_id: string;
}

@Controller('bookmarks')
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  @Post()
  @UseGuards(OptionalAuthGuard)
  create(@Body() dto: CreateBookmarkDto, @Req() req: Request) {
    return this.bookmarksService.create(dto.session_id, dto.round_id, (req as any).user?._id);
  }

  @Get()
  @UseGuards(OptionalAuthGuard)
  list(@Req() req: Request) {
    return this.bookmarksService.list((req as any).user?._id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bookmarksService.remove(id);
  }
}
