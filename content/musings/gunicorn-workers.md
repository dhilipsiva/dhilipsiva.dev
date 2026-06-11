+++
title = "Appropriate Number of Gunicorn Workers"
date = 2015-10-22
description = "The 2n+1 rule for Gunicorn workers, a one-liner to apply it on any Linux box, and the StackOverflow answer it came from."

[taxonomies]
tags = ["python", "devops"]

[extra]
type = "notes"
original_url = "https://medium.com/@dhilipsiva/appropriate-number-of-gunicorn-workers-3a827a7eccdc"
original_platform = "Medium"
+++

To quote [Gunicorn documentation](http://docs.gunicorn.org/en/19.3/design.html#how-many-workers):

> Generally we recommend (2 x $num_cores) + 1 as the number of workers to start off with. While not overly scientific, the formula is based on the assumption that for a given core, one worker will be reading or writing from the socket while the other worker is processing a request. Obviously, your particular hardware and application are going to affect the optimal number of workers. Our recommendation is to start with the above guess and tune using TTIN and TTOU signals while the application is under load.

Gunicorn docs suggests that 2n+1 (`gunicorn -w <2n+1> myapp:wsgi`) is a good guess for number of workers (Yes, n = number of cores). I came up with a tiny shell script to apply this formula. All you need to do is this:

```bash
gunicorn -w $(( 2 * `cat /proc/cpuinfo | grep 'core id' | wc -l` + 1 )) myapp:wsgi
```

Where the command

```bash
cat /proc/cpuinfo | grep 'core id' | wc -l
```

will return the total number of actual CPU cores (n). So,

```bash
$(( 2 * `cat /proc/cpuinfo | grep 'core id' | wc -l` + 1 ))
```

equates to 2n+1 formula.

This will apply 2n+1 formula to all the linux-based machines.

You can also achieve this with [Gunicorn Configuration File](http://docs.gunicorn.org/en/19.3/configure.html#configuration-file) gunicorn.conf.py as follows:

```python
import multiprocessing

bind = "127.0.0.1:8000"
workers = multiprocessing.cpu_count() * 2 + 1
```

This was an [answer that I posted on StackOverflow](http://stackoverflow.com/questions/15979428/what-is-the-appropriate-number-of-gunicorn-workers-for-each-amazon-instance-type/27664071#27664071).
