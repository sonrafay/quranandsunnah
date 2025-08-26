// =============================
// FILE: src/components/app/ProfileMenu.tsx
"use client";


import {
DropdownMenu,
DropdownMenuContent,
DropdownMenuItem,
DropdownMenuLabel,
DropdownMenuSeparator,
DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bookmark, LogIn, Settings, User } from "lucide-react";
import Link from "next/link";


export default function ProfileMenu() {
return (
<DropdownMenu>
<DropdownMenuTrigger asChild>
<button aria-label="Account" className="rounded-full border bg-background/60 backdrop-blur p-1.5">
<Avatar className="h-7 w-7">
<AvatarFallback>QS</AvatarFallback>
</Avatar>
</button>
</DropdownMenuTrigger>
<DropdownMenuContent align="end" className="w-48">
<DropdownMenuLabel>Account</DropdownMenuLabel>
<DropdownMenuSeparator />
<DropdownMenuItem asChild>
<Link href="/account"><User className="mr-2 h-4 w-4"/>Profile</Link>
</DropdownMenuItem>
<DropdownMenuItem asChild>
<Link href="/bookmarks"><Bookmark className="mr-2 h-4 w-4"/>Bookmarks</Link>
</DropdownMenuItem>
<DropdownMenuItem asChild>
<Link href="/settings"><Settings className="mr-2 h-4 w-4"/>Settings</Link>
</DropdownMenuItem>
<DropdownMenuSeparator />
<DropdownMenuItem asChild>
<Link href="/login"><LogIn className="mr-2 h-4 w-4"/>Sign in</Link>
</DropdownMenuItem>
</DropdownMenuContent>
</DropdownMenu>
);
}